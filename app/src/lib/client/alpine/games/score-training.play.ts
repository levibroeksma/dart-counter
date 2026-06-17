import Alpine from "alpinejs";
import type { ConfirmationModalStore } from "@lib/client/alpine/stores/confirmationModal.store";
import type {
  ApiResponse,
  ScoreTrainingSessionSuccess,
} from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildRoundRecord } from "@lib/shared/games/score-training/round";
import { buildSummary, type ScoreTrainingSummary } from "@lib/shared/games/score-training/summary";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";
import { t } from "@lib/shared/i18n";

/**
 * Alpine state factory for Score Training play flow.
 */
export function scoreTrainingPlay(initialSession: ScoreTrainingSession) {
  let timerId: ReturnType<typeof setInterval> | null = null;

  return {
    session: initialSession,
    score: null as string | null,
    loading: false,
    error: "",
    showSummary: false,
    summary: null as ScoreTrainingSummary | null,
    timerExpired: false,

    get controlsDisabled() {
      return this.loading || this.session.state.status === "paused" || this.showSummary;
    },

    get timerShouldTick() {
      return (
        this.session.settings.endMode === "timed" &&
        this.session.state.status === "active" &&
        this.score === null &&
        !this.showSummary
      );
    },

    get threeDartAverageDisplay() {
      const roundsPlayed = this.session.roundHistory.length;
      if (roundsPlayed === 0) return "0.0";
      return (this.session.state.currentScore / roundsPlayed).toFixed(1);
    },

    get dartsThrownDisplay() {
      return String(this.session.roundHistory.length * 3);
    },

    get lastScoreDisplay() {
      return this.session.state.lastScore === null ? "—" : String(this.session.state.lastScore);
    },

    get timerDisplay() {
      const total = Math.max(0, this.session.timeRemainingSeconds ?? 0);
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    },

    get summaryAverageDisplay() {
      if (!this.summary) return "0.0";
      return this.summary.threeDartAverage.toFixed(1);
    },

    init() {
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
      window.location.href = "/games";
    },

    async submitScore() {
      if (this.score === null) return;
      const parsed = Number(this.score);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 180) return;

      const round = buildRoundRecord(
        this.session.state.currentRound,
        parsed,
        this.session.state.currentScore,
      );

      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/score-training/session/round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            round,
            timeRemainingSeconds: this.session.timeRemainingSeconds ?? undefined,
            timerExpired: this.timerExpired,
          }),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }

        const success = data as ScoreTrainingSessionSuccess;
        this.session = success.session;
        this.score = null;

        if (success.completed) {
          this.showSummary = true;
          this.summary = success.summary ?? buildSummary(success.session);
          this.stopTimer();
        } else {
          this.showSummary = false;
          this.summary = null;
          this.timerExpired = false;
        }
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    async completeOnTimerExpiry() {
      if (this.session.settings.endMode !== "timed") return;
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/score-training/session/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeRemainingSeconds: this.session.timeRemainingSeconds ?? undefined,
          }),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }

        const success = data as ScoreTrainingSessionSuccess;
        this.session = success.session;
        this.showSummary = true;
        this.summary = success.summary ?? buildSummary(success.session);
        this.timerExpired = true;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
        this.stopTimer();
      }
    },

    async undo() {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/score-training/session/round/last", {
          method: "DELETE",
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }
        this.session = (data as ScoreTrainingSessionSuccess).session;
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
        if (!this.timerShouldTick) return;
        if (this.session.timeRemainingSeconds === null) return;
        if (this.session.timeRemainingSeconds <= 0) return;

        this.session.timeRemainingSeconds -= 1;
        if (this.session.timeRemainingSeconds > 0) return;

        this.session.timeRemainingSeconds = 0;
        if (this.score === null) {
          void this.completeOnTimerExpiry();
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
