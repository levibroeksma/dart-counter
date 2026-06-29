import Alpine from "alpinejs";
import type { ConfirmationModalStore } from "@lib/client/alpine/stores/confirmationModal.store";
import type {
  ApiResponse,
  ScoreTrainingCompleteSuccess,
} from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildRoundRecord } from "@lib/shared/games/score-training/round";
import type { ScoreTrainingSummary } from "@lib/shared/games/score-training/summary";
import {
  isScoreTrainingSession,
  type ScoreTrainingSession,
} from "@lib/shared/games/score-training/session";
import { buildScoreTrainingSession } from "@lib/shared/games/score-training/session-factory";
import {
  applyRoundToState,
  revertRoundFromState,
} from "@lib/shared/games/score-training/state";
import { t } from "@lib/shared/i18n";

export const SCORE_TRAINING_SESSION_KEY = "score-training-session";

/** Removes the persisted in-progress session from sessionStorage. */
export function clearPersistedScoreTrainingSession(): void {
  sessionStorage.removeItem(Alpine.prefixed(SCORE_TRAINING_SESSION_KEY));
}

/**
 * Alpine state factory for Score Training play flow.
 *
 * Holds session state client-side via Alpine $persist (sessionStorage).
 * Applies rounds locally; POSTs only on completion.
 */
export function scoreTrainingPlay(serverSession: ScoreTrainingSession | null) {
  let timerId: ReturnType<typeof setInterval> | null = null;

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: (Alpine as any)
      .$persist(serverSession)
      .as(SCORE_TRAINING_SESSION_KEY)
      .using(sessionStorage) as ScoreTrainingSession | null,
    score: null as string | null,
    loading: false,
    ready: false,
    error: "",
    showSummary: false,
    summary: null as ScoreTrainingSummary | null,
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
        !this.showSummary
      );
    },

    get threeDartAverageDisplay() {
      const roundsPlayed = this.session?.roundHistory.length ?? 0;
      if (roundsPlayed === 0) return "0.0";
      return ((this.session?.state.currentScore ?? 0) / roundsPlayed).toFixed(
        1,
      );
    },

    get dartsThrownDisplay() {
      return String((this.session?.roundHistory.length ?? 0) * 3);
    },

    get lastScoreDisplay() {
      const lastScore = this.session?.state.lastScore;
      return lastScore === null || lastScore === undefined
        ? "—"
        : String(lastScore);
    },

    get timerDisplay() {
      const total = Math.max(0, this.session?.timeRemainingSeconds ?? 0);
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    },

    get summaryAverageDisplay() {
      if (!this.summary) return "0.0";
      return this.summary.threeDartAverage.toFixed(1);
    },

    init() {
      if (serverSession) {
        this.session = serverSession;
      }
      if (
        !isScoreTrainingSession(this.session) ||
        this.session.state.status === "completed"
      ) {
        window.location.href = "/games/settings-score-training";
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
      clearPersistedScoreTrainingSession();
      window.location.href = "/games";
    },

    submitScore() {
      if (!this.session || this.score === null) return;
      const parsed = Number(this.score);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 180) return;

      const round = buildRoundRecord(
        this.session.state.currentRound,
        parsed,
        this.session.state.currentScore,
      );

      this.session.roundHistory = [...this.session.roundHistory, round];
      this.session.state = applyRoundToState(
        this.session.state,
        round,
        this.session.settings,
        this.timerExpired,
      );
      this.score = null;

      if (this.session.state.status === "completed") {
        this.showSummary = true;
        this.stopTimer();
        void this.persistCompletion();
      } else {
        this.timerExpired = false;
      }
    },

    undo() {
      if (!this.session || this.session.roundHistory.length === 0) return;
      const removedRound =
        this.session.roundHistory[this.session.roundHistory.length - 1];
      const previousHistory = this.session.roundHistory.slice(0, -1);
      const previousLastScore =
        previousHistory.length > 0
          ? (previousHistory[previousHistory.length - 1]?.visitScore ?? null)
          : null;

      this.session.roundHistory = previousHistory;
      this.session.state = revertRoundFromState(
        this.session.state,
        removedRound,
        previousLastScore,
      );
    },

    async persistCompletion() {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/score-training/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: this.session }),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }
        const success = data as ScoreTrainingCompleteSuccess;
        this.summary = success.summary;
        clearPersistedScoreTrainingSession();
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    playAgain() {
      if (!this.session || !this.summary) return;

      const settings = this.session.settings;
      this.session = buildScoreTrainingSession(settings);
      this.showSummary = false;
      this.summary = null;
      this.score = null;
      this.timerExpired = false;
      this.error = "";

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
