import Alpine from "alpinejs";
import type { ConfirmationModalStore } from "@lib/client/alpine/stores/confirmationModal.store";
import type {
  ApiResponse,
  FiveOhOneCompleteSuccess,
} from "@lib/shared/api/types";
import { getCheckoutHint, type ModalQuestion } from "@lib/shared/darts";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  applyVisit,
  buildFiveOhOneSession,
  buildMatchFormatLabel,
  buildSummary,
  canUndoDartBotPair,
  canUndoUserCheckoutBeforeBotLegStart,
  deriveBotVisitDartMetadata,
  isDartBotSession,
  isDartBotTurn,
  isFiveOhOneSession,
  isMatchWinningCheckoutPossible,
  revertLastOpponentPair,
  revertLastVisit,
  format501PlayerDisplayName,
  resolve501CheckoutModal,
  simulateDartBotVisitForSession,
  validateVisitScore,
  type CheckoutModalKind,
  type FiveOhOnePlayer,
  type FiveOhOneSession,
  type FiveOhOneSummary,
} from "@lib/shared/games/501";
import { validateMatchStats } from "@lib/shared/dartbot";
import { animateDartBotVisit } from "@lib/client/alpine/games/dartbot-turn-modal";
import { t } from "@lib/shared/i18n";
import * as scoreInput from "@lib/client/alpine/score-input";

export const FIVE_OH_ONE_SESSION_KEY = "501-session";

/** Removes the persisted in-progress 501 session from sessionStorage. */
export function clearPersistedFiveOhOneSession(): void {
  sessionStorage.removeItem(Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    botTurnActive: false,
    botModalOpen: false,
    botModalSegmentLabel: "—",
    botModalDartLabels: [] as string[],
    botAbortController: null as AbortController | null,
    showModal: false,
    modalKind: null as CheckoutModalKind | null,
    modalQuestions: [] as ModalQuestion[],
    dartsOnDouble: null as number | null,
    dartsForFinish: null as number | null,
    pendingVisitScore: null as number | null,
    botRngBefore: null as number | null,

    get controlsDisabled() {
      return (
        !this.ready ||
        this.showSummary ||
        this.persisting ||
        this.botTurnActive ||
        this.showModal
      );
    },

    get canUndo() {
      if (!this.session || this.showModal) return false;
      if (isDartBotSession(this.session)) {
        return (
          canUndoDartBotPair(this.session) ||
          canUndoUserCheckoutBeforeBotLegStart(this.session)
        );
      }
      return this.session.visitHistory.length > 0;
    },

    get modalCanSubmit() {
      if (this.dartsOnDouble === null) return false;
      if (this.modalKind === "finish") {
        if (this.dartsForFinish === null) return false;
        return this.dartsOnDouble <= this.dartsForFinish;
      }
      return true;
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

    formatPlayerName(player: FiveOhOnePlayer) {
      return format501PlayerDisplayName(player);
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
      void this.maybePlayBotTurn();
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
      void this.maybePlayBotTurn();
    },

    async submitVisit() {
      if (
        !this.session ||
        this.session.state.phase !== "play" ||
        this.botTurnActive ||
        isDartBotTurn(this.session) ||
        this.showModal
      ) {
        return;
      }
      const validation = validateVisitScore(this.score);
      if (!validation.valid) return;
      const visitScore = validation.value;
      const previewSession = applyVisit(this.session, visitScore);
      const previewVisit = previewSession.visitHistory.at(-1);
      if (!previewVisit) return;

      const resolvedModal = resolve501CheckoutModal(
        previewVisit.remainingBefore,
        visitScore,
        {
          bust: previewVisit.bust,
          checkout: previewVisit.checkout,
          remainingAfter: previewVisit.remainingAfter,
        },
      );

      this.botRngBefore = this.session.botState?.rngState ?? null;
      if (resolvedModal) {
        this.showModal = true;
        this.modalKind = resolvedModal.kind;
        this.modalQuestions = resolvedModal.questions;
        this.pendingVisitScore = visitScore;
        this.dartsOnDouble = null;
        this.dartsForFinish = null;
        this.applyAutoValues();
        this.score = null;
        return;
      }
      await this.commitVisit(visitScore);
    },

    undoVisit() {
      if (!this.session || this.persisting || this.botTurnActive || this.showModal) return;
      if (isDartBotSession(this.session)) {
        if (canUndoUserCheckoutBeforeBotLegStart(this.session)) {
          this.session = revertLastVisit(this.session);
          return;
        }
        this.session = revertLastOpponentPair(this.session);
        return;
      }
      this.session = revertLastVisit(this.session);
    },

    applyAutoValues() {
      for (const question of this.modalQuestions) {
        if (question.autoValue === undefined) continue;
        if (question.id === "dartsOnDouble") {
          this.dartsOnDouble = question.autoValue;
        }
        if (question.id === "dartsForFinish") {
          this.dartsForFinish = question.autoValue;
        }
      }
    },

    closeModal() {
      this.showModal = false;
      this.modalKind = null;
      this.modalQuestions = [];
      this.dartsOnDouble = null;
      this.dartsForFinish = null;
      this.pendingVisitScore = null;
    },

    async commitVisit(
      visitScore: number,
      dartMeta?: { dartsOnDouble: number; dartsForFinish?: number },
    ) {
      if (!this.session || this.session.state.phase !== "play") return;
      const botRngBefore = this.botRngBefore ?? this.session.botState?.rngState;
      this.session = applyVisit(this.session, visitScore, {
        botRngBefore: botRngBefore ?? undefined,
        dartsOnDouble: dartMeta?.dartsOnDouble,
        dartsForFinish: dartMeta?.dartsForFinish,
      });
      this.score = null;
      this.pendingVisitScore = null;
      this.botRngBefore = null;

      if (this.session.state.status === "completed") {
        this.completeMatch();
        return;
      }

      if (isDartBotTurn(this.session)) {
        this.botTurnActive = true;
        await this.runDartBotTurn();
      }
    },

    async modalSubmit() {
      if (!this.session || this.pendingVisitScore === null || !this.modalCanSubmit) {
        return;
      }
      const visitScore = this.pendingVisitScore;
      const dartMeta =
        this.modalKind === "finish"
          ? {
              dartsOnDouble: this.dartsOnDouble as number,
              dartsForFinish: this.dartsForFinish as number,
            }
          : {
              dartsOnDouble: this.dartsOnDouble as number,
            };
      this.closeModal();
      await this.commitVisit(visitScore, dartMeta);
    },

    completeMatch() {
      if (!this.session) return;
      if (this.session.botState) {
        const dartBot = this.session.settings.players.find(
          (player) => player.type === "dartbot",
        );
        if (dartBot?.type === "dartbot") {
          const botVisits = this.session.visitHistory.filter(
            (visit) => visit.playerId === dartBot.id,
          );
          const checkouts = botVisits.filter((visit) => visit.checkout);
          const pointsScored = botVisits.reduce((total, visit) => {
            const scored = visit.remainingBefore - visit.remainingAfter;
            return total + (scored > 0 ? scored : 0);
          }, 0);
          const matchStats = {
            threeDartAverage: botVisits.length === 0 ? 0 : pointsScored / botVisits.length,
            scoringAverage: botVisits.length === 0 ? 0 : pointsScored / botVisits.length,
            checkoutAverage:
              checkouts.length === 0
                ? 0
                : checkouts.reduce((sum, visit) => sum + visit.remainingBefore, 0) /
                  checkouts.length,
            checkoutRate: botVisits.length === 0 ? 0 : checkouts.length / botVisits.length,
          };
          const validation = validateMatchStats(
            matchStats,
            this.session.botState.matchPlan.skill,
          );
          if (validation.withinTolerance) {
            console.debug("DartBot match stats validation", validation);
          } else {
            console.log("DartBot match stats outside tolerance", validation);
          }
        }
      }
      this.summary = buildSummary(this.session);
      this.showSummary = true;
      this.persisting = true;
      void this.persistCompletion();
    },

    async maybePlayBotTurn() {
      if (
        !this.session ||
        this.session.state.phase !== "play" ||
        !isDartBotTurn(this.session) ||
        this.botTurnActive
      ) {
        return;
      }
      this.botTurnActive = true;
      const delayMs = isMatchWinningCheckoutPossible(this.session) ? 300 : 500;
      await wait(delayMs);

      if (
        !this.session ||
        this.session.state.phase !== "play" ||
        !isDartBotTurn(this.session)
      ) {
        this.botTurnActive = false;
        return;
      }

      await this.runDartBotTurn();
    },

    skipDartBotTurnAnimation() {
      this.botAbortController?.abort();
    },

    async runDartBotTurn() {
      if (
        !this.session ||
        this.session.state.phase !== "play" ||
        !isDartBotTurn(this.session)
      ) {
        this.botTurnActive = false;
        return;
      }

      this.botModalOpen = true;
      this.botModalSegmentLabel = "Thinking...";
      this.botModalDartLabels = [];
      this.botAbortController = new AbortController();
      let visitScore: number;
      let dartMeta:
        | ReturnType<typeof deriveBotVisitDartMetadata>
        | undefined;

      try {
        const simulated = simulateDartBotVisitForSession(this.session);
        this.session = simulated.session;
        dartMeta = deriveBotVisitDartMetadata(simulated.visit);
        const landedLabels = simulated.visit.darts.map((dart) => dart.actual.label);

        await animateDartBotVisit(simulated.visit, {
          dartMs: 800,
          holdMs: 600,
          signal: this.botAbortController.signal,
          onDart: (segmentLabel, index) => {
            this.botModalSegmentLabel = segmentLabel;
            this.botModalDartLabels = landedLabels.slice(0, index + 1);
          },
          onComplete: () => {
            this.botModalDartLabels = landedLabels;
          },
        });

        visitScore = simulated.visit.visitScore;
      } catch (error) {
        console.debug("DartBot simulation failed; applying fallback visit", error);
        visitScore = 0;
      } finally {
        this.botAbortController = null;
        this.botModalOpen = false;
        this.botModalSegmentLabel = "—";
      }

      if (!this.session) {
        this.botTurnActive = false;
        return;
      }

      this.session = applyVisit(this.session, visitScore, dartMeta);
      this.botTurnActive = false;

      if (this.session.state.status === "completed") {
        this.completeMatch();
      }
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
          this.persisting = false;
          return;
        }
        const success = data as FiveOhOneCompleteSuccess;
        this.summary = success.summary;
        clearPersistedFiveOhOneSession();
        this.persisting = false;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
        this.persisting = false;
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
