import Alpine from "alpinejs";
import type { ConfirmationModalStore } from "@lib/client/alpine/stores/confirmationModal.store";
import type {
  ApiResponse,
  TenUpOneDownCompleteSuccess,
} from "@lib/shared/api/types";
import {
  buildFailureModalQuestions,
  buildSuccessModalQuestions,
  getCheckoutHint,
  type ModalQuestion,
} from "@lib/shared/darts";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  applyRoundToState,
  buildRoundRecord,
  buildTenUpOneDownSession,
  isTenUpOneDownSession,
  resolveRoundOutcome,
  revertRoundFromState,
  type TenUpOneDownSession,
  type TenUpOneDownSummary,
} from "@lib/shared/games/ten-up-one-down";
import { t } from "@lib/shared/i18n";
import * as scoreInput from "@lib/client/alpine/score-input";

export const TEN_UP_ONE_DOWN_SESSION_KEY = "ten-up-one-down-session";

/** Removes the persisted in-progress session from sessionStorage. */
export function clearPersistedTenUpOneDownSession(): void {
  sessionStorage.removeItem(Alpine.prefixed(TEN_UP_ONE_DOWN_SESSION_KEY));
}

/**
 * Alpine state factory for Ten Up One Down play flow.
 *
 * Holds session state client-side via Alpine $persist (sessionStorage).
 * Applies rounds locally; POSTs only on completion.
 */
export function tenUpOneDownPlay(serverSession: TenUpOneDownSession | null) {
  let timerId: ReturnType<typeof setInterval> | null = null;

  return {
    score: null as string | null,
    _scoreInputClickBlockedUntil: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: (Alpine as any)
      .$persist(serverSession)
      .as(TEN_UP_ONE_DOWN_SESSION_KEY)
      .using(sessionStorage) as TenUpOneDownSession | null,
    showModal: false,
    outcome: null as "success" | "failure" | null,
    dartsOnDouble: null as number | null,
    dartsForFinish: null as number | null,
    dartsUsed: null as number | null,
    modalQuestions: [] as ModalQuestion[],
    loading: false,
    ready: false,
    error: "",
    showSummary: false,
    summary: null as TenUpOneDownSummary | null,
    timerExpired: false,

    get controlsDisabled() {
      return (
        !this.ready ||
        this.loading ||
        this.session?.state.status === "paused" ||
        this.showSummary
      );
    },

    get timerShouldTick() {
      return (
        this.session?.settings.endMode === "timed" &&
        this.session?.state.status === "active" &&
        this.score === null &&
        !this.showModal &&
        !this.showSummary
      );
    },

    get checkoutHintSegments() {
      return getCheckoutHint(this.session?.state.currentTarget ?? 0)?.segments ?? [];
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

    appendScoreDigit(digit: string, event?: Event) {
      scoreInput.appendScoreDigit(this, digit, event);
    },

    backspaceScoreDigit(event?: Event) {
      scoreInput.backspaceScoreDigit(this, event);
    },

    init() {
      if (serverSession) {
        this.session = serverSession;
      }
      if (
        !isTenUpOneDownSession(this.session) ||
        this.session.state.status === "completed"
      ) {
        window.location.href = "/games/settings-ten-up-one-down";
        return;
      }
      this.ready = true;
      if (this.session.settings.endMode === "timed") {
        this.startTimer();
      }
    },

    leave() {
      (Alpine.store("confirmationModal") as ConfirmationModalStore).open({
        title: "Leave game?",
        message: "Your progress in this session will be lost.",
        onConfirm: () => this.confirmLeave(),
      });
    },

    confirmLeave() {
      clearPersistedTenUpOneDownSession();
      window.location.href = "/games";
    },

    submitScore() {
      if (!this.session) return;
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
      if (!this.session || !this.modalCanSubmit || this.outcome === null) return;

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

      const timedModeExpired =
        this.timerExpired ||
        (this.session.settings.endMode === "timed" &&
          this.session.timeRemainingSeconds !== null &&
          this.session.timeRemainingSeconds <= 0);

      this.session.roundHistory = [...this.session.roundHistory, round];
      this.session.state = applyRoundToState(
        this.session.state,
        round,
        this.session.settings,
      );

      if (timedModeExpired) {
        this.session.state = { ...this.session.state, status: "completed" };
      }

      this.score = null;
      this.closeModal();

      if (this.session.state.status === "completed") {
        this.showSummary = true;
        this.stopTimer();
        await this.persistCompletion();
      } else {
        this.timerExpired = false;
      }
    },

    undo() {
      if (!this.session || this.session.roundHistory.length === 0) return;
      const removedRound =
        this.session.roundHistory[this.session.roundHistory.length - 1]!;
      this.session.roundHistory = this.session.roundHistory.slice(0, -1);
      this.session.state = revertRoundFromState(
        this.session.state,
        removedRound,
      );
    },

    async persistCompletion() {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/ten-up-one-down/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: this.session }),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }
        const success = data as TenUpOneDownCompleteSuccess;
        this.summary = success.summary;
        clearPersistedTenUpOneDownSession();
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    playAgain() {
      if (!this.session || !this.summary) return;

      const settings = this.session.settings;
      this.session = buildTenUpOneDownSession(settings);
      this.showSummary = false;
      this.summary = null;
      this.score = null;
      this.timerExpired = false;
      this.error = "";
      this.closeModal();

      if (this.session.settings.endMode === "timed") {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    },

    completeOnTimerExpiry() {
      if (!this.session || this.session.settings.endMode !== "timed") return;
      this.timerExpired = true;
      this.session.state = { ...this.session.state, status: "completed" };
      this.showSummary = true;
      this.stopTimer();
      void this.persistCompletion();
    },

    togglePause() {
      if (!this.session || this.session.settings.endMode !== "timed") return;
      this.session.state.status =
        this.session.state.status === "paused" ? "active" : "paused";

      if (this.session.state.status === "active") {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    },

    startTimer() {
      if (!this.session || this.session.settings.endMode !== "timed") return;
      this.stopTimer();
      timerId = setInterval(() => {
        if (!this.timerShouldTick) return;
        if (!this.session || this.session.timeRemainingSeconds === null) return;
        if (this.session.timeRemainingSeconds <= 0) return;

        this.session.timeRemainingSeconds -= 1;
        if (this.session.timeRemainingSeconds > 0) return;

        this.session.timeRemainingSeconds = 0;
        if (this.score === null) {
          this.completeOnTimerExpiry();
          return;
        }

        this.timerExpired = true;
        this.stopTimer();
      }, 1000);
    },

    stopTimer() {
      if (!timerId) return;
      clearInterval(timerId);
      timerId = null;
    },
  };
}
