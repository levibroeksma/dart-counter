import { getOpponentPlayer } from "./bot-helpers";
import { DARTS_PER_VISIT } from "./constants";
import type {
  FiveOhOnePlayer,
  FiveOhOnePlayerSummary,
  FiveOhOneSession,
  FiveOhOneSettings,
  FiveOhOneSummary,
  FiveOhOneVisitRecord,
} from "./types";

export type { FiveOhOneSummary } from "./types";

type PlayerScoringStats = {
  threeDartAverage: number;
  checkoutsMade: number;
  checkoutAttempts: number;
};

function toUnitLabel(unit: FiveOhOneSettings["unit"], count: number): string {
  if (count === 1) {
    return unit === "legs" ? "leg" : "set";
  }
  return unit;
}

function buildWinnerDisplayName(session: FiveOhOneSession): string {
  const user = session.settings.players.find((p) => p.type === "user");
  if (session.settings.players.length === 1) {
    return user?.name ?? "You";
  }

  const winningPlayerId = getWinningPlayerId(session);
  const winner = session.settings.players.find(
    (player) => player.id === winningPlayerId,
  );

  if (!winner) return "Match completed";
  if (winner.type === "dartbot") return "DartBot";
  return winner.name;
}

export function buildMatchFormatLabel(settings: FiveOhOneSettings): string {
  const unitLabel = toUnitLabel(settings.unit, settings.targetCount);
  if (settings.matchMode === "first-to") {
    return `First to ${settings.targetCount} ${unitLabel}`;
  }
  return `Best of ${settings.targetCount} ${unitLabel}`;
}

function getWinningPlayerId(session: FiveOhOneSession): string | undefined {
  return [...session.visitHistory]
    .reverse()
    .find((visit) => visit.checkout)?.playerId;
}

function getPlayerScoringStats(
  history: FiveOhOneVisitRecord[],
  playerId: string,
): PlayerScoringStats {
  const playerVisits = history.filter((visit) => visit.playerId === playerId);
  const dartsThrown = playerVisits.reduce((sum, v) => sum + v.dartsThrown, 0);
  const pointsScored = playerVisits.reduce((total, visit) => {
    const points = visit.remainingBefore - visit.remainingAfter;
    return total + (points > 0 ? points : 0);
  }, 0);
  const checkoutAttempts = playerVisits.reduce(
    (sum, visit) => sum + (visit.dartsOnDouble ?? 0),
    0,
  );
  const checkoutsMade = playerVisits.filter((visit) => visit.checkout).length;

  return {
    threeDartAverage:
      dartsThrown === 0 ? 0 : pointsScored / (dartsThrown / DARTS_PER_VISIT),
    checkoutsMade,
    checkoutAttempts,
  };
}

function computeFirstNineAverage(
  history: FiveOhOneVisitRecord[],
  playerId: string,
): number | null {
  const playerVisits = history.filter((visit) => visit.playerId === playerId);
  if (playerVisits.length < 3) return null;

  const firstThree = playerVisits.slice(0, 3);
  const dartsThrown = firstThree.reduce((sum, visit) => sum + visit.dartsThrown, 0);
  const pointsScored = firstThree.reduce((total, visit) => {
    const points = visit.remainingBefore - visit.remainingAfter;
    return total + (points > 0 ? points : 0);
  }, 0);

  if (dartsThrown === 0) return null;
  return pointsScored / (dartsThrown / DARTS_PER_VISIT);
}

function computeHighestFinish(
  playerVisits: FiveOhOneVisitRecord[],
): number | null {
  const checkoutVisits = playerVisits.filter((visit) => visit.checkout);
  if (checkoutVisits.length === 0) return null;
  return Math.max(...checkoutVisits.map((visit) => visit.remainingBefore));
}

function computeHighestScore(
  playerVisits: FiveOhOneVisitRecord[],
): number | null {
  if (playerVisits.length === 0) return null;
  return Math.max(...playerVisits.map((visit) => visit.visitScore));
}

function computeLegDartsForWonLegs(
  history: FiveOhOneVisitRecord[],
  playerId: string,
): number[] {
  const wonLegKeys = new Set<string>();
  for (const visit of history) {
    if (visit.checkout && visit.playerId === playerId) {
      wonLegKeys.add(`${visit.setNumber}-${visit.legNumber}`);
    }
  }

  const legDarts: number[] = [];
  for (const legKey of wonLegKeys) {
    const [setNumber, legNumber] = legKey.split("-").map(Number);
    const dartsInLeg = history
      .filter(
        (visit) =>
          visit.playerId === playerId &&
          visit.setNumber === setNumber &&
          visit.legNumber === legNumber,
      )
      .reduce((sum, visit) => sum + visit.dartsThrown, 0);
    legDarts.push(dartsInLeg);
  }

  return legDarts;
}

function buildPlayerSummary(
  session: FiveOhOneSession,
  player: FiveOhOnePlayer,
  winningPlayerId: string | undefined,
): FiveOhOnePlayerSummary {
  const playerVisits = session.visitHistory.filter(
    (visit) => visit.playerId === player.id,
  );
  const scoring = getPlayerScoringStats(session.visitHistory, player.id);
  const playerState = session.state.players.find(
    (state) => state.playerId === player.id,
  );
  const legDarts = computeLegDartsForWonLegs(session.visitHistory, player.id);

  return {
    playerId: player.id,
    displayName: player.type === "dartbot" ? "DartBot" : player.name,
    isBot: player.type === "dartbot",
    isGuest: player.type === "guest",
    isWinner: player.id === winningPlayerId,
    setsWon: playerState?.setsWon ?? 0,
    legsWon: playerState?.totalLegsWon ?? 0,
    threeDartAverage: scoring.threeDartAverage,
    firstNineAverage: computeFirstNineAverage(session.visitHistory, player.id),
    checkoutRate:
      scoring.checkoutAttempts === 0
        ? null
        : (scoring.checkoutsMade / scoring.checkoutAttempts) * 100,
    checkoutsMade: scoring.checkoutsMade,
    checkoutAttempts: scoring.checkoutAttempts,
    highestFinish: computeHighestFinish(playerVisits),
    highestScore: computeHighestScore(playerVisits),
    bestLegDarts: legDarts.length === 0 ? null : Math.min(...legDarts),
    worstLegDarts: legDarts.length === 0 ? null : Math.max(...legDarts),
  };
}

function getPlayersForSummary(session: FiveOhOneSession): FiveOhOnePlayer[] {
  if (session.settings.players.length === 1) {
    return session.settings.players;
  }

  const userPlayer = session.settings.players.find(
    (player) => player.type === "user",
  );
  if (!userPlayer) {
    return session.settings.players;
  }

  const opponent = getOpponentPlayer(session, userPlayer.id);
  return opponent ? [userPlayer, opponent] : [userPlayer];
}

export function buildSummary(session: FiveOhOneSession): FiveOhOneSummary {
  const winningPlayerId = getWinningPlayerId(session);
  const players = getPlayersForSummary(session).map((player) =>
    buildPlayerSummary(session, player, winningPlayerId),
  );

  return {
    winnerDisplayName: buildWinnerDisplayName(session),
    showSetsRow: session.settings.unit === "sets",
    players,
  };
}
