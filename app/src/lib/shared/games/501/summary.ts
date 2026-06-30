import { getOpponentPlayer } from "./bot-helpers";
import { DARTS_PER_VISIT } from "./constants";
import type {
  FiveOhOneSession,
  FiveOhOneSettings,
  FiveOhOneSummary,
  FiveOhOneVisitRecord,
} from "./types";

export type { FiveOhOneSummary } from "./types";

type PlayerSummaryStats = {
  threeDartAverage: number;
  dartsThrown: number;
  checkouts: number;
};

function toUnitLabel(unit: FiveOhOneSettings["unit"], count: number): string {
  if (count === 1) {
    return unit === "legs" ? "leg" : "set";
  }
  return unit;
}

export function buildMatchFormatLabel(settings: FiveOhOneSettings): string {
  const unitLabel = toUnitLabel(settings.unit, settings.targetCount);
  if (settings.matchMode === "first-to") {
    return `First to ${settings.targetCount} ${unitLabel}`;
  }
  return `Best of ${settings.targetCount} ${unitLabel}`;
}

function getPlayerSummaryStats(
  history: FiveOhOneVisitRecord[],
  playerId: string,
): PlayerSummaryStats {
  const playerVisits = history.filter((visit) => visit.playerId === playerId);
  const dartsThrown = playerVisits.length * DARTS_PER_VISIT;
  const pointsScored = playerVisits.reduce((total, visit) => {
    const points = visit.remainingBefore - visit.remainingAfter;
    return total + (points > 0 ? points : 0);
  }, 0);

  return {
    threeDartAverage:
      dartsThrown === 0 ? 0 : pointsScored / (dartsThrown / DARTS_PER_VISIT),
    dartsThrown,
    checkouts: playerVisits.filter((visit) => visit.checkout).length,
  };
}

function buildResultLabel(session: FiveOhOneSession): string {
  if (session.settings.players.length === 1) {
    return "Completed";
  }

  const winningPlayerId = [...session.visitHistory]
    .reverse()
    .find((visit) => visit.checkout)?.playerId;
  const winnerName = session.settings.players.find(
    (player) => player.id === winningPlayerId,
  )?.name;
  return winnerName ? `${winnerName} wins` : "Match completed";
}

/**
 * Builds 501 end-of-match summary values from session history and settings.
 */
export function buildSummary(session: FiveOhOneSession): FiveOhOneSummary {
  const userPlayer = session.settings.players.find(
    (player) => player.type === "user",
  );
  const opponentPlayer = userPlayer
    ? getOpponentPlayer(session, userPlayer.id)
    : undefined;
  const userStats = userPlayer
    ? getPlayerSummaryStats(session.visitHistory, userPlayer.id)
    : { threeDartAverage: 0, dartsThrown: 0, checkouts: 0 };

  const summary: FiveOhOneSummary = {
    resultLabel: buildResultLabel(session),
    matchFormatLabel: buildMatchFormatLabel(session.settings),
    legsPlayed: session.visitHistory.filter((visit) => visit.checkout).length,
    userThreeDartAverage: userStats.threeDartAverage,
    userDartsThrown: userStats.dartsThrown,
    checkouts: userStats.checkouts,
  };

  if (session.settings.players.length === 2 && opponentPlayer) {
    const opponentStats = getPlayerSummaryStats(
      session.visitHistory,
      opponentPlayer.id,
    );
    summary.guestThreeDartAverage = opponentStats.threeDartAverage;
    summary.guestDartsThrown = opponentStats.dartsThrown;
    summary.guestCheckouts = opponentStats.checkouts;
  }

  return summary;
}
