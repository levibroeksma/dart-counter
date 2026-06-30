import { hasPlayerWonMatch } from "./match";
import type { FiveOhOneSession, Player501Stats } from "./types";
import { buildSummary } from "./summary";

export type { Player501Stats } from "./types";

/**
 * Creates a zeroed aggregate stats object for 501 player history.
 */
export function createEmpty501Stats(): Player501Stats {
  return {
    gamesCompleted: 0,
    gamesWon: 0,
    totalDartsThrown: 0,
    totalCheckouts: 0,
    bestLegAverage: 0,
    bestMatchAverage: 0,
  };
}

/**
 * Returns the highest 3-dart average achieved by the user in any leg.
 */
function getBestLegAverage(session: FiveOhOneSession, userId: string): number {
  const legTotals = new Map<string, { points: number; darts: number }>();

  for (const visit of session.visitHistory) {
    const legKey = `${visit.setNumber}-${visit.legNumber}`;
    const totals = legTotals.get(legKey) ?? { points: 0, darts: 0 };

    if (visit.playerId === userId) {
      const points = Math.max(visit.remainingBefore - visit.remainingAfter, 0);
      totals.points += points;
      totals.darts += 3;
    }

    legTotals.set(legKey, totals);
  }

  let best = 0;
  for (const { points, darts } of legTotals.values()) {
    if (darts === 0) continue;
    const average = points / (darts / 3);
    if (average > best) best = average;
  }

  return best;
}

/**
 * Returns true when the authenticated user won a completed 2-player match.
 */
function didUserWin(session: FiveOhOneSession): boolean {
  if (session.settings.players.length !== 2) {
    return false;
  }

  const user = session.settings.players.find((player) => player.type === "user");
  if (!user) {
    return false;
  }

  const userState = session.state.players.find(
    (player) => player.playerId === user.id,
  );
  if (!userState) {
    return false;
  }

  return hasPlayerWonMatch(session.settings, userState);
}

/**
 * Applies one completed 501 game into cumulative user stats.
 */
export function applyGameCompletionToStats(
  stats: Player501Stats,
  session: FiveOhOneSession,
): void {
  const summary = buildSummary(session);
  const user = session.settings.players.find((player) => player.type === "user");
  const userId = user?.id;

  stats.gamesCompleted += 1;
  if (didUserWin(session)) {
    stats.gamesWon += 1;
  }

  stats.totalDartsThrown += summary.userDartsThrown;
  stats.totalCheckouts += summary.checkouts;

  if (summary.userThreeDartAverage > stats.bestMatchAverage) {
    stats.bestMatchAverage = summary.userThreeDartAverage;
  }

  if (userId) {
    const bestLegAverage = getBestLegAverage(session, userId);
    if (bestLegAverage > stats.bestLegAverage) {
      stats.bestLegAverage = bestLegAverage;
    }
  }
}
