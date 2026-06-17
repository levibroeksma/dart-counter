import Alpine from "alpinejs";
import type { ConfirmationModalStore } from "@lib/client/alpine/stores/confirmationModal.store";
import type {
  ApiResponse,
  SinglesTrainingSessionSuccess,
} from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  formatDartOutcomeLabel,
  type DartOutcome,
} from "@lib/shared/games/singles-training/dart";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";
import {
  buildSummary,
  type SinglesTrainingSummary,
} from "@lib/shared/games/singles-training/summary";
import { t } from "@lib/shared/i18n";

/**
 * Alpine data factory for Singles Training play flow.
 */
export function singlesTrainingPlay(initialSession: SinglesTrainingSession) {
  return {
    session: initialSession,
    loading: false,
    error: "",
    showSummary: false,
    summary: null as SinglesTrainingSummary | null,

    get controlsDisabled() {
      return this.loading || this.showSummary;
    },

    get currentTarget() {
      return this.session.targetSequence[this.session.state.currentTargetIndex];
    },

    get isBullTarget() {
      return this.currentTarget === "bull";
    },

    get targetDisplay() {
      return this.isBullTarget ? "Bull" : String(this.currentTarget);
    },

    get visitDartLabels() {
      const labels: [string, string, string] = ["-", "-", "-"];
      for (const dart of this.session.dartHistory) {
        if (dart.targetIndex !== this.session.state.currentTargetIndex) continue;
        labels[dart.dartInVisit] = formatDartOutcomeLabel(this.currentTarget, dart.outcome);
      }
      return labels;
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

    async submitDart(outcome: DartOutcome) {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/singles-training/session/dart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcome }),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }

        const success = data as SinglesTrainingSessionSuccess;
        this.session = success.session;
        if (success.terminal) {
          this.showSummary = true;
          this.summary = success.summary ?? buildSummary(success.session);
          return;
        }

        this.showSummary = false;
        this.summary = null;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    async undoDart() {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/singles-training/session/dart/last", {
          method: "DELETE",
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }
        this.session = (data as SinglesTrainingSessionSuccess).session;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    async playAgain() {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/singles-training/session/play-again", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.session.settings),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }

        this.session = (data as SinglesTrainingSessionSuccess).session;
        this.showSummary = false;
        this.summary = null;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },
  };
}
