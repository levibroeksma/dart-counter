import { eq } from "drizzle-orm";
import { db, playerDartStats } from "@db/index";
import { getEntryEnv } from "@lib/shared/constants/entry-env";
import { withEntryEnv } from "@lib/server/data/entry-env";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";
import type { PlayerDartStats } from "@lib/shared/stats/types";

function mapStatsToColumns(stats: PlayerDartStats) {
  return {
    doubleAttempts: stats.doubleAttempts,
    doubleHits: stats.doubleHits,
    totalCheckouts: stats.totalCheckouts,
    totalCheckoutDarts: stats.totalCheckoutDarts,
  };
}

/**
 * Reads global player dart stats for a user.
 */
export async function getPlayerDartStats(
  userId: string
): Promise<PlayerDartStats> {
  const rows = await db
    .select()
    .from(playerDartStats)
    .where(withEntryEnv(playerDartStats.entryEnv, eq(playerDartStats.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return createEmptyPlayerDartStats();

  return {
    doubleAttempts: row.doubleAttempts,
    doubleHits: row.doubleHits,
    totalCheckouts: row.totalCheckouts,
    totalCheckoutDarts: row.totalCheckoutDarts,
  };
}

/**
 * Persists global player dart stats for a user.
 */
export async function savePlayerDartStats(
  userId: string,
  stats: PlayerDartStats
): Promise<void> {
  await db
    .insert(playerDartStats)
    .values({ userId, entryEnv: getEntryEnv(), ...mapStatsToColumns(stats) })
    .onConflictDoUpdate({
      target: [playerDartStats.userId, playerDartStats.entryEnv],
      set: mapStatsToColumns(stats),
    });
}
