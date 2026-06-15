import type { OpenOptions } from "@lib/client/alpine/stores/confirmationModal.store";
import type {
  ApiResponse,
  TenUpOneDownSessionSuccess,
} from "@lib/shared/api/types";
import {
  buildFailureModalQuestions,
  buildSuccessModalQuestions,
  type ModalQuestion,
} from "@lib/shared/darts/checkout-constraints";
import { getCheckoutHint } from "@lib/shared/darts/checkouts";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { resolveRoundOutcome } from "@lib/shared/games/ten-up-one-down/outcome";
import { buildRoundRecord } from "@lib/shared/games/ten-up-one-down/round";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";
import { t } from "@lib/shared/i18n";

/**
 * Alpine state factory for Ten Up One Down play flow.
 */
export function tenUpOneDownPlay(initialSession: TenUpOneDownSession) {
  let timerId: ReturnType<typeof setInterval> | null = null;

  type ConfirmationModal = { open: (options: OpenOptions) => void };

  return {
    $store: {} as { confirmationModal: ConfirmationModal },
    session: initialSession,
    score: null as string | null,
    showModal: false,
    outcome: null as "success" | "failure" | null,
    dartsOnDouble: null as number | null,
    dartsForFinish: null as number | null,
    dartsUsed: null as number | null,
    modalQuestions: [] as ModalQuestion[],
    loading: false,
    error: "",
    timerExpired: false,

    get controlsDisabled() {
      return this.loading || this.session.state.status === "paused";
    },

    get checkoutHintSegments() {
      return getCheckoutHint(this.session.state.currentTarget)?.segments ?? [];
    },

    get checkoutHintDisplay() {
      const segments = this.checkoutHintSegments;
      return segments.length > 0 ? segments.join(" ") : null;
    },

    get modalCanSubmit() {
      if (this.outcome === "success") {
        if (this.dartsForFinish === null || this.dartsOnDouble === null) {
          return false;
        }
        return this.dartsOnDouble <= this.dartsForFinish;
      }
      if (this.dartsUsed === null || this.dartsOnDouble === null) {
        return false;
      }
      return this.dartsOnDouble <= this.dartsUsed;
    },

    init() {
      if (this.session.settings.endMode === "timed") {
        this.startTimer();
      }
    },

    leave() {
      this.$store.confirmationModal.open({
        title: "Leave game?",
        message: "Your progress in this session will be lost.",
        onConfirm: () => this.confirmLeave(),
      });
    },

    confirmLeave() {
      window.location.href = "/games";
    },

    submitScore() {
      const resolved = resolveRoundOutcome(
        this.score,
        this.session.state.currentTarget,
      );
      if (resolved === null) return;

      this.outcome = resolved;
      this.dartsOnDouble = null;
      this.dartsForFinish = null;
      this.dartsUsed = null;
      this.modalQuestions =
        resolved === "success"
          ? buildSuccessModalQuestions(this.session.state.currentTarget)
          : buildFailureModalQuestions();
      this.applyAutoValues();
      this.showModal = true;
    },

    applyAutoValues() {
      for (const q of this.modalQuestions) {
        if (q.autoValue !== undefined) {
          this[q.id] = q.autoValue;
        }
      }
    },

    closeModal() {
      this.showModal = false;
      this.outcome = null;
      this.dartsOnDouble = null;
      this.dartsForFinish = null;
      this.dartsUsed = null;
      this.modalQuestions = [];
    },

    async modalSubmit() {
      if (!this.modalCanSubmit || this.outcome === null) return;

      const input =
        this.outcome === "success"
          ? {
              outcome: "success" as const,
              dartsForFinish: this.dartsForFinish as 1 | 2 | 3,
              dartsOnDouble: this.dartsOnDouble as 1 | 2 | 3,
            }
          : {
              outcome: "failure" as const,
              dartsUsed: this.dartsUsed as 1 | 2 | 3,
              dartsOnDouble: this.dartsOnDouble as 0 | 1 | 2 | 3,
            };

      const round = buildRoundRecord(
        this.session.state.currentRound,
        this.session.state.currentTarget,
        input,
      );
      const timerExpired =
        this.timerExpired ||
        (this.session.settings.endMode === "timed" &&
          this.session.timeRemainingSeconds !== null &&
          this.session.timeRemainingSeconds <= 0);

      this.loading = true;
      this.error = "";
      try {
        const response = await fetch(
          "/api/games/ten-up-one-down/session/round",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ round, timerExpired }),
          },
        );
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
        this.score = null;
        this.closeModal();
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
        const response = await fetch(
          "/api/games/ten-up-one-down/session/round/last",
          {
            method: "DELETE",
          },
        );
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
  };
}
