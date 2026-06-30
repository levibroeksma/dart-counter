import { DARTS_PER_VISIT, STARTING_SCORE } from "./constants";
import { hasPlayerWonMatch, hasPlayerWonSet } from "./match";
import { lastTwoVisitsAreUserThenDartBot } from "./bot-helpers";
import type {
  FiveOhOneGameState,
  FiveOhOnePlayerState,
  FiveOhOneSession,
  FiveOhOneVisitRecord,
} from "./types";
import { classifyVisit } from "./visit";
import { deepClone } from "@lib/shared/utils/deep-clone";

function cloneGameState(state: FiveOhOneGameState): FiveOhOneGameState {
  return deepClone(state);
}

function getOpponentId(players: FiveOhOnePlayerState[], playerId: string): string {
  return players.find((player) => player.playerId !== playerId)?.playerId ?? playerId;
}

function nextLegStarterId(state: FiveOhOneGameState): string {
  if (state.players.length === 1) {
    return state.players[0]!.playerId;
  }

  return getOpponentId(state.players, state.legStartingPlayerId);
}

function resetPlayersForNewLeg(players: FiveOhOnePlayerState[]): void {
  for (const player of players) {
    player.remaining = STARTING_SCORE;
    player.dartsThisLeg = 0;
    player.lastVisitScore = null;
  }
}

/**
 * Applies a single visit to a 501 session and returns updated session state.
 */
export function applyVisit(
  session: FiveOhOneSession,
  visitScore: number,
  options?: { botRngBefore?: number },
): FiveOhOneSession {
  const sessionBase = deepClone(session);
  const now = new Date().toISOString();
  const stateBeforeVisit = cloneGameState(sessionBase.state);
  const nextState = cloneGameState(sessionBase.state);
  const currentPlayer = nextState.players.find(
    (player) => player.playerId === nextState.currentPlayerId,
  );

  if (!currentPlayer) {
    return { ...session, updatedAt: now };
  }

  const outcome = classifyVisit(currentPlayer.remaining, visitScore);
  nextState.scoreAtVisitStart = currentPlayer.remaining;

  const visitRecord: FiveOhOneVisitRecord = {
    visitNumber: sessionBase.visitHistory.length + 1,
    playerId: currentPlayer.playerId,
    visitScore,
    remainingBefore: currentPlayer.remaining,
    remainingAfter: outcome.remainingAfter,
    bust: outcome.bust,
    checkout: outcome.checkout,
    legNumber: nextState.currentLeg,
    setNumber: nextState.currentSet,
    stateSnapshot: stateBeforeVisit,
    botRngBefore: options?.botRngBefore,
  };

  const nextHistory = [...sessionBase.visitHistory, visitRecord];
  const isTwoPlayer = nextState.players.length === 2;

  if (!outcome.bust) {
    currentPlayer.remaining = outcome.remainingAfter;
    currentPlayer.dartsThisLeg += DARTS_PER_VISIT;
    currentPlayer.lastVisitScore = visitScore;
  }

  if (outcome.checkout) {
    currentPlayer.legsWonInSet += 1;
    currentPlayer.totalLegsWon += 1;

    const completedSet = hasPlayerWonSet(currentPlayer);
    if (completedSet) {
      currentPlayer.setsWon += 1;
      for (const player of nextState.players) {
        player.legsWonInSet = 0;
      }
      nextState.currentSet += 1;
    }

    if (hasPlayerWonMatch(sessionBase.settings, currentPlayer)) {
      nextState.status = "completed";
      nextState.phase = "summary";
    } else {
      resetPlayersForNewLeg(nextState.players);
      const starterId = nextLegStarterId(nextState);
      nextState.legStartingPlayerId = starterId;
      nextState.currentPlayerId = starterId;
      nextState.currentLeg = completedSet ? 1 : nextState.currentLeg + 1;
      nextState.phase = "play";
      nextState.status = "active";
      nextState.scoreAtVisitStart = STARTING_SCORE;
    }

    if (sessionBase.botState) {
      sessionBase.botState.currentLegIndex += 1;
    }
  } else if (isTwoPlayer) {
    nextState.currentPlayerId = getOpponentId(nextState.players, currentPlayer.playerId);
  }

  if (!isTwoPlayer) {
    nextState.currentPlayerId = nextState.players[0]!.playerId;
  }

  return {
    ...sessionBase,
    state: nextState,
    visitHistory: nextHistory,
    updatedAt: now,
  };
}

/**
 * Reverts the most recent visit by restoring the pre-visit state snapshot.
 */
export function revertLastVisit(session: FiveOhOneSession): FiveOhOneSession {
  const sessionBase = deepClone(session);

  if (sessionBase.visitHistory.length === 0) {
    return sessionBase;
  }

  const now = new Date().toISOString();
  const nextHistory = [...sessionBase.visitHistory];
  const lastVisit = nextHistory.pop();

  if (!lastVisit) {
    return sessionBase;
  }

  return {
    ...sessionBase,
    state: cloneGameState(lastVisit.stateSnapshot),
    visitHistory: nextHistory,
    updatedAt: now,
  };
}

/**
 * Reverts the latest user + dartbot visit pair and rewinds bot RNG state.
 */
export function revertLastOpponentPair(session: FiveOhOneSession): FiveOhOneSession {
  const sessionBase = deepClone(session);
  if (!lastTwoVisitsAreUserThenDartBot(sessionBase)) {
    return sessionBase;
  }

  const now = new Date().toISOString();
  const nextHistory = [...sessionBase.visitHistory];
  nextHistory.pop();
  const userVisit = nextHistory.pop();

  if (!userVisit) {
    return sessionBase;
  }

  const nextSession: FiveOhOneSession = {
    ...sessionBase,
    state: cloneGameState(userVisit.stateSnapshot),
    visitHistory: nextHistory,
    updatedAt: now,
  };

  if (typeof userVisit.botRngBefore === "number" && nextSession.botState) {
    nextSession.botState.rngState = userVisit.botRngBefore;
  }

  return nextSession;
}
