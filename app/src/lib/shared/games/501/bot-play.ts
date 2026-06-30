import {
  computeSetRunningStats,
  createRng,
  generateMatchPlan,
  simulateVisit,
  type BotVisitForStats,
  type SimulatedVisit,
} from "@lib/shared/dartbot";
import { isFinishableCheckout } from "@lib/shared/darts";
import { isDartBotTurn } from "./bot-helpers";
import { DARTS_PER_VISIT } from "./constants";
import { hasPlayerWonMatch, hasPlayerWonSet } from "./match";
import type { FiveOhOnePlayerState, FiveOhOneSession } from "./types";
import { deepClone } from "@lib/shared/utils/deep-clone";

type SimulateDartBotVisitResult = {
  session: FiveOhOneSession;
  visit: SimulatedVisit;
};

function isScoringVisit(remainingBefore: number): boolean {
  return remainingBefore > 170;
}

function doubleAttemptsFromVisit(visit: SimulatedVisit): number {
  return visit.darts.filter(
    (dart) => dart.actual.ring === "double" || dart.actual.ring === "bull",
  ).length;
}

function historyVisitToStats(visit: {
  remainingBefore: number;
  visitScore: number;
  dartsThrown: number;
  dartsOnDouble?: number;
  checkout: boolean;
}): BotVisitForStats {
  return {
    dartsThrown: visit.dartsThrown,
    visitScore: visit.visitScore,
    isScoringVisit: isScoringVisit(visit.remainingBefore),
    doubleAttempts: visit.dartsOnDouble ?? 0,
    checkouts: visit.checkout ? 1 : 0,
  };
}

function getCurrentPlayerState(session: FiveOhOneSession): FiveOhOnePlayerState {
  const player = session.state.players.find(
    (entry) => entry.playerId === session.state.currentPlayerId,
  );
  if (!player) {
    throw new Error("Current player state not found");
  }
  return player;
}

/**
 * Returns true when the active dartbot can finish and immediately win the match.
 */
export function isMatchWinningCheckoutPossible(session: FiveOhOneSession): boolean {
  if (!isDartBotTurn(session)) return false;

  const player = getCurrentPlayerState(session);
  if (!isFinishableCheckout(player.remaining)) return false;

  const projected: FiveOhOnePlayerState = {
    ...player,
    legsWonInSet: player.legsWonInSet + 1,
    totalLegsWon: player.totalLegsWon + 1,
  };

  if (hasPlayerWonSet(projected)) {
    projected.setsWon += 1;
    projected.legsWonInSet = 0;
  }

  return hasPlayerWonMatch(session.settings, projected);
}

/**
 * Simulates one dartbot visit and advances bot RNG/match-plan state.
 */
export function simulateDartBotVisitForSession(
  session: FiveOhOneSession,
): SimulateDartBotVisitResult {
  if (!session.botState) {
    throw new Error("DartBot state is missing for this session");
  }

  const nextSession = deepClone(session);
  const botState = nextSession.botState;
  const currentPlayer = getCurrentPlayerState(nextSession);

  if (!botState) {
    throw new Error("DartBot state is missing for this session");
  }

  if (botState.currentLegIndex >= botState.matchPlan.legTargets.length) {
    const planner = generateMatchPlan(
      botState.matchPlan.skill,
      botState.matchPlan.legTargets.length,
      botState.matchPlan.seed,
    );
    botState.matchPlan.legTargets = planner.extendLegTargets(
      botState.currentLegIndex + 1,
    );
  }

  const rng = createRng(botState.rngState);
  const legTarget = botState.matchPlan.legTargets[botState.currentLegIndex] ?? 0;
  const visit = simulateVisit(
    {
      remaining: currentPlayer.remaining,
      skill: botState.matchPlan.skill,
      legTarget,
      dartsInVisit: DARTS_PER_VISIT,
      setRunningStats: botState.setRunningStats,
    },
    rng,
  );
  botState.rngState = rng.getState();
  const botPlayerId = nextSession.state.currentPlayerId;
  const currentSetVisits = nextSession.visitHistory
    .filter(
      (entry) =>
        entry.playerId === botPlayerId && entry.setNumber === botState.setNumber,
    )
    .map(historyVisitToStats);
  currentSetVisits.push({
    dartsThrown: visit.darts.length,
    visitScore: visit.visitScore,
    isScoringVisit: isScoringVisit(currentPlayer.remaining),
    doubleAttempts: doubleAttemptsFromVisit(visit),
    checkouts: visit.checkout ? 1 : 0,
  });
  botState.setRunningStats = computeSetRunningStats(currentSetVisits);

  return { session: nextSession, visit };
}
