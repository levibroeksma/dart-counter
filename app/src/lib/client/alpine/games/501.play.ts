import Alpine from "alpinejs";
import type { ConfirmationModalStore } from "@lib/client/alpine/stores/confirmationModal.store";
import type {
  ApiResponse,
  FiveOhOneCompleteSuccess,
} from "@lib/shared/api/types";
import { getCheckoutHint } from "@lib/shared/darts/checkouts";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildFiveOhOneSession } from "@lib/shared/games/501/session-factory";
import {
  isFiveOhOneSession,
  type FiveOhOneSession,
} from "@lib/shared/games/501/session";
import type { FiveOhOneSummary } from "@lib/shared/games/501/summary";
import {
  buildSummary,
  buildMatchFormatLabel,
} from "@lib/shared/games/501/summary";
import { applyVisit, revertLastVisit } from "@lib/shared/games/501/state";
import { validateVisitScore } from "@lib/shared/games/501/validation";
import { t } from "@lib/shared/i18n";
import * as scoreInput from "@lib/client/alpine/score-input";

export const FIVE_OH_ONE_SESSION_KEY = "501-session";

/** Removes the persisted in-progress 501 session from sessionStorage. */
export function clearPersistedFiveOhOneSession(): void {
  sessionStorage.removeItem(Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY));
}

function getPlayerVisits(session: FiveOhOneSession, playerId: string) {
  return session.visitHistory.filter((visit) => visit.playerId === playerId);
}

/** Alpine state factory for 501 play flow. */
export function fiveOhOnePlay(serverSession: FiveOhOneSession | null) {
  return {
    score: null as string | null,
    _scoreInputClickBlockedUntil: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: (Alpine as any)
      .$persist(serverSession)
      .as(FIVE_OH_ONE_SESSION_KEY)
      .using(sessionStorage) as FiveOhOneSession | null,
    ready: false,
    error: "",
    showSummary: false,
    summary: null as FiveOhOneSummary | null,
    persisting: false,

    get controlsDisabled() {
      return !this.ready || this.showSummary || this.persisting;
    },

    appendScoreDigit(digit: string, event?: Event) {
      scoreInput.appendScoreDigit(this, digit, event);
    },

    backspaceScoreDigit(event?: Event) {
      scoreInput.backspaceScoreDigit(this, event);
    },

    matchFormatLabelDisplay() {
      if (!this.session) return "";
      return buildMatchFormatLabel(this.session.settings);
    },

    init() {
      if (serverSession) {
        this.session = serverSession;
      }
      if (
        !isFiveOhOneSession(this.session) ||
        this.session.state.status === "completed"
      ) {
        window.location.href = "/games/settings-501";
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
      if (this.persisting) return;
      clearPersistedFiveOhOneSession();
      window.location.href = "/games";
    },

    selectStarter(playerId: string) {
      if (!this.session || this.session.state.phase !== "starter") return;
      const starter = this.session.state.players.find(
        (player) => player.playerId === playerId,
      );
      if (!starter) return;
      this.session.state.legStartingPlayerId = playerId;
      this.session.state.currentPlayerId = playerId;
      this.session.state.phase = "play";
    },

    submitVisit() {
      if (!this.session || this.session.state.phase !== "play") return;
      const validation = validateVisitScore(this.score);
      if (!validation.valid) return;

      this.session = applyVisit(this.session, validation.value);
      this.score = null;

      if (this.session.state.status === "completed") {
        this.completeMatch();
      }
    },

    undoVisit() {
      if (!this.session || this.persisting) return;
      this.session = revertLastVisit(this.session);
    },

    completeMatch() {
      if (!this.session) return;
      this.summary = buildSummary(this.session);
      this.showSummary = true;
      this.persisting = true;
      void this.persistCompletion();
    },

    async persistCompletion() {
      if (!this.session) return;
      this.error = "";
      try {
        const response = await fetch("/api/games/501/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: this.session }),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }
        const success = data as FiveOhOneCompleteSuccess;
        this.summary = success.summary;
        clearPersistedFiveOhOneSession();
        this.persisting = false;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      }
    },

    playAgain() {
      if (!this.session || !this.summary || this.persisting) return;
      const settings = this.session.settings;
      this.session = buildFiveOhOneSession(settings);
      this.score = null;
      this.error = "";
      this.summary = null;
      this.showSummary = false;
    },

    backToGames() {
      if (this.persisting) return;
      window.location.href = "/games";
    },

    threeDartAverageDisplay(playerId: string) {
      if (!this.session) return "0.0";
      const playerVisits = getPlayerVisits(this.session, playerId);
      if (playerVisits.length === 0) return "0.0";
      const pointsScored = playerVisits.reduce((total, visit) => {
        const points = visit.remainingBefore - visit.remainingAfter;
        return total + (points > 0 ? points : 0);
      }, 0);
      return (pointsScored / playerVisits.length).toFixed(1);
    },

    checkoutHintDisplay(playerId: string) {
      const player = this.session?.state.players.find(
        (entry) => entry.playerId === playerId,
      );
      if (!player) return null;
      const hint = getCheckoutHint(player.remaining);
      return hint ? hint.segments.join(" ") : null;
    },

    lastScoreDisplay(playerId: string) {
      const player = this.session?.state.players.find(
        (entry) => entry.playerId === playerId,
      );
      if (!player || player.lastVisitScore === null) return "—";
      return String(player.lastVisitScore);
    },

    dartsDisplay(playerId: string) {
      const player = this.session?.state.players.find(
        (entry) => entry.playerId === playerId,
      );
      return String(player?.dartsThisLeg ?? 0);
    },
  };
}
