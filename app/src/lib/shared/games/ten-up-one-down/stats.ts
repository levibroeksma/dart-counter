import { applyRoundToStats } from "@lib/shared/stats/double-stats";
import type { PlayerDartStats } from "@lib/shared/stats/types";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";

/**
 * Applies all rounds from a completed session to aggregate player dart stats.
 */
export function applyGameCompletionToStats(
  stats: PlayerDartStats,
  session: TenUpOneDownSession,
): void {
  for (const round of session.roundHistory) {
    applyRoundToStats(stats, round);
  }
}
