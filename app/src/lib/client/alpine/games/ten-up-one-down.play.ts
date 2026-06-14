import type { ApiResponse, TenUpOneDownSessionSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import type { DoubleTarget } from "@lib/shared/darts/doubles";
import { buildRoundRecord, type WizardInput } from "@lib/shared/games/ten-up-one-down/round";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";
import { t } from "@lib/shared/i18n";

type WizardStep =
  | "outcome"
  | "dartsUsed"
  | "onDouble"
  | "doubleSelect"
  | "busted"
  | "submit";

/**
 * Alpine state factory for Ten Up One Down play flow.
 */
export function tenUpOneDownPlay(initialSession: TenUpOneDownSession) {
  let timerId: ReturnType<typeof setInterval> | null = null;

  return {
    session: initialSession,
    step: "outcome" as WizardStep,
    targetHit: null as boolean | null,
    dartsUsed: 0 as 0 | 1 | 2 | 3,
    onDouble: 0 as 0 | 1 | 2 | 3,
    finishedOnDouble: null as DoubleTarget | null,
    doubleAttempted: null as DoubleTarget | null,
    busted: null as boolean | null,
    loading: false,
    error: "",
    timerExpired: false,

    get isSuccess() {
      return this.targetHit === true;
    },

    get controlsDisabled() {
      return this.loading || this.session.state.status === "paused";
    },

    get showDartSteps() {
      return this.step === "dartsUsed" || this.step === "onDouble";
    },

    get showDoubleGrid() {
      if (this.step !== "doubleSelect") return false;
      if (this.isSuccess) return this.dartsUsed > 0 && this.onDouble > 0;
      return this.onDouble > 0;
    },

    wizardNext() {
      if (this.step === "outcome" && this.targetHit !== null) {
        this.step = "dartsUsed";
        return;
      }

      if (this.step === "dartsUsed" && this.dartsUsed > 0) {
        this.step = "onDouble";
        return;
      }

      if (this.step === "onDouble") {
        if (this.isSuccess && this.onDouble > 0) {
          this.step = "doubleSelect";
          return;
        }

        if (!this.isSuccess && this.onDouble > 0) {
          this.step = "doubleSelect";
          return;
        }

        if (!this.isSuccess) {
          this.step = "busted";
        }
        return;
      }

      if (this.step === "doubleSelect") {
        this.step = this.isSuccess ? "submit" : "busted";
        return;
      }

      if (this.step === "busted" && this.busted !== null) {
        this.step = "submit";
      }
    },

    wizardBack() {
      if (this.step === "submit") {
        this.step = this.isSuccess ? "doubleSelect" : "busted";
        return;
      }
      if (this.step === "busted") {
        this.step = this.onDouble > 0 ? "doubleSelect" : "onDouble";
        return;
      }
      if (this.step === "doubleSelect") {
        this.step = "onDouble";
        return;
      }
      if (this.step === "onDouble") {
        this.step = "dartsUsed";
        return;
      }
      if (this.step === "dartsUsed") {
        this.step = "outcome";
      }
    },

    resetWizard() {
      this.step = "outcome";
      this.targetHit = null;
      this.dartsUsed = 0;
      this.onDouble = 0;
      this.finishedOnDouble = null;
      this.doubleAttempted = null;
      this.busted = null;
      this.error = "";
    },

    buildInput(): WizardInput {
      if (this.isSuccess) {
        return {
          outcome: "success",
          dartsUsed: this.dartsUsed as 1 | 2 | 3,
          onDouble: this.onDouble as 1 | 2 | 3,
          finishedOnDouble: this.finishedOnDouble as DoubleTarget,
        };
      }

      return {
        outcome: "failure",
        dartsUsed: this.dartsUsed as 1 | 2 | 3,
        onDouble: this.onDouble as 0 | 1 | 2 | 3,
        doubleAttempted: this.doubleAttempted,
        busted: Boolean(this.busted),
      };
    },

    async submit() {
      const round = buildRoundRecord(
        this.session.state.currentRound,
        this.session.state.currentTarget,
        this.buildInput()
      );

      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/ten-up-one-down/session/round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(round),
        });
        const data = (await response.json()) as ApiResponse;

        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }

        const success = data as TenUpOneDownSessionSuccess;
        if (success.completed) {
          window.location.href = "/games";
          return;
        }

        this.session = success.session;
        this.resetWizard();
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    async undo() {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/ten-up-one-down/session/round/last", {
          method: "DELETE",
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }
        this.session = (data as TenUpOneDownSessionSuccess).session;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    togglePause() {
      if (this.session.settings.endMode !== "timed") return;
      this.session.state.status =
        this.session.state.status === "paused" ? "active" : "paused";

      if (this.session.state.status === "active") {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    },

    startTimer() {
      if (this.session.settings.endMode !== "timed") return;
      this.stopTimer();
      timerId = setInterval(() => {
        if (this.session.state.status !== "active") return;
        if (this.session.timeRemainingSeconds === null) return;
        if (this.session.timeRemainingSeconds <= 0) {
          this.timerExpired = true;
          this.stopTimer();
          return;
        }
        this.session.timeRemainingSeconds -= 1;
      }, 1000);
    },

    stopTimer() {
      if (!timerId) return;
      clearInterval(timerId);
      timerId = null;
    },

    init() {
      if (this.session.settings.endMode === "timed") {
        this.startTimer();
      }
    },
  };
}
