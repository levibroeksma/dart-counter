import Alpine from "alpinejs";
import type { ConfirmationModalStore } from "@lib/client/alpine/stores/confirmationModal.store";
import type {
  ApiResponse,
  SinglesTrainingCompleteSuccess,
} from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  applyDartToSession,
  buildSinglesTrainingSession,
  formatDartOutcomeLabel,
  isSinglesTrainingSession,
  isValidOutcomeForTarget,
  revertLastDart,
  type DartOutcome,
  type SinglesTrainingSession,
  type SinglesTrainingSummary,
} from "@lib/shared/games/singles-training";
import { t } from "@lib/shared/i18n";

export const SINGLES_TRAINING_SESSION_KEY = "singles-training-session";

/** Removes the persisted in-progress session from sessionStorage. */
export function clearPersistedSinglesTrainingSession(): void {
  sessionStorage.removeItem(Alpine.prefixed(SINGLES_TRAINING_SESSION_KEY));
}

/**
 * Alpine data factory for Singles Training play flow.
 */
export function singlesTrainingPlay(serverSession: SinglesTrainingSession | null) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: (Alpine as any)
      .$persist(serverSession)
      .as(SINGLES_TRAINING_SESSION_KEY)
      .using(sessionStorage) as SinglesTrainingSession | null,
    loading: false,
    ready: false,
    error: "",
    showSummary: false,
    summary: null as SinglesTrainingSummary | null,

    get controlsDisabled() {
      return !this.ready || this.loading || this.showSummary;
    },

    get currentTarget() {
      return this.session?.targetSequence[this.session.state.currentTargetIndex];
    },

    get isBullTarget() {
      return this.currentTarget === "bull";
    },

    get targetDisplay() {
      return this.isBullTarget ? "Bull" : String(this.currentTarget);
    },

    get visitDartLabels() {
      const labels: [string, string, string] = ["-", "-", "-"];
      if (!this.session) return labels;
      for (const dart of this.session.dartHistory) {
        if (dart.targetIndex !== this.session.state.currentTargetIndex) continue;
        labels[dart.dartInVisit] = formatDartOutcomeLabel(this.currentTarget!, dart.outcome);
      }
      return labels;
    },

    init() {
      if (serverSession) {
        this.session = serverSession;
      }
      if (!isSinglesTrainingSession(this.session) || this.session.state.status !== "active") {
        window.location.href = "/games/settings-singles-training";
        return;
      }
      this.ready = true;
    },

    leave() {
      (Alpine.store("confirmationModal") as ConfirmationModalStore).open({
        title: "Leave game?",
        message: "Your progress in this session will be lost.",
        onConfirm: () => this.confirmLeave(),
      });
    },

    confirmLeave() {
      clearPersistedSinglesTrainingSession();
      window.location.href = "/games";
    },

    submitDart(outcome: DartOutcome) {
      if (!this.session || this.showSummary) return;
      const target = this.session.targetSequence[this.session.state.currentTargetIndex];
      if (!isValidOutcomeForTarget(target, outcome)) return;

      this.session = applyDartToSession(this.session, outcome);

      if (this.session.state.status === "completed" || this.session.state.status === "dead") {
        this.showSummary = true;
        void this.persistCompletion();
      }
    },

    undoDart() {
      if (!this.session || this.session.dartHistory.length === 0 || this.showSummary) {
        return;
      }
      this.session = revertLastDart(this.session);
    },

    async persistCompletion() {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/singles-training/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: this.session }),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }
        const success = data as SinglesTrainingCompleteSuccess;
        this.summary = success.summary;
        clearPersistedSinglesTrainingSession();
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    playAgain() {
      if (!this.session || !this.summary) return;

      const settings = this.session.settings;
      this.session = buildSinglesTrainingSession(settings);
      this.showSummary = false;
      this.summary = null;
      this.error = "";
    },
  };
}
