import { ALL_DOUBLES } from "@lib/shared/darts/doubles";
import type { PlayerDartStats } from "@lib/shared/stats/types";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

export function createEmptyPlayerDartStats(): PlayerDartStats {
  const doubleStats = Object.fromEntries(
    ALL_DOUBLES.map((d) => [d, { attempts: 0, successes: 0 }])
  ) as PlayerDartStats["doubleStats"];
  return { doubleStats, totalCheckouts: 0, totalCheckoutDarts: 0 };
}

export function applyRoundToStats(stats: PlayerDartStats, round: TenUpOneDownRoundRecord): void {
  for (const attempt of round.doubleAttempts) {
    stats.doubleStats[attempt.double].attempts++;
    if (attempt.hit) stats.doubleStats[attempt.double].successes++;
  }
  if (round.finished) {
    stats.totalCheckouts++;
    stats.totalCheckoutDarts += round.dartsUsed;
  }
}

export function revertRoundFromStats(stats: PlayerDartStats, round: TenUpOneDownRoundRecord): void {
  for (const attempt of round.doubleAttempts) {
    stats.doubleStats[attempt.double].attempts--;
    if (attempt.hit) stats.doubleStats[attempt.double].successes--;
  }
  if (round.finished) {
    stats.totalCheckouts--;
    stats.totalCheckoutDarts -= round.dartsUsed;
  }
}
