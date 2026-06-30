import type { PlayerDartStats } from "./types";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down";

export function createEmptyPlayerDartStats(): PlayerDartStats {
  return {
    doubleAttempts: 0,
    doubleHits: 0,
    totalCheckouts: 0,
    totalCheckoutDarts: 0,
  };
}

export function applyRoundToStats(stats: PlayerDartStats, round: TenUpOneDownRoundRecord): void {
  stats.doubleAttempts += round.dartsOnDouble;
  if (round.finished) {
    stats.doubleHits += 1;
    stats.totalCheckouts += 1;
    stats.totalCheckoutDarts += round.dartsUsed;
  }
}

export function revertRoundFromStats(stats: PlayerDartStats, round: TenUpOneDownRoundRecord): void {
  stats.doubleAttempts -= round.dartsOnDouble;
  if (round.finished) {
    stats.doubleHits -= 1;
    stats.totalCheckouts -= 1;
    stats.totalCheckoutDarts -= round.dartsUsed;
  }
}
