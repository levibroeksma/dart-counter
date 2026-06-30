import { applyRoundToStats, type PlayerDartStats } from "@lib/shared/stats";
import type { TenUpOneDownSession } from "./types";

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
