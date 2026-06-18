import { eq } from "drizzle-orm";
import { db, playerSinglesTrainingStats } from "@db/index";
import {
  createEmptySinglesTrainingStats,
  type PlayerSinglesTrainingStats,
} from "@lib/shared/games/singles-training/stats";

function mapStatsToColumns(stats: PlayerSinglesTrainingStats) {
  return {
    gamesCompleted: stats.gamesCompleted,
    gamesFailed: stats.gamesFailed,
    totalDartsThrown: stats.totalDartsThrown,
    totalHits: stats.totalHits,
    totalScore: stats.totalScore,
    dartPositionHits: [...stats.dartPositionHits],
    dartPositionAttempts: [...stats.dartPositionAttempts],
    bestHitRatio: stats.bestHitRatio,
    bestScore: stats.bestScore,
  };
}

/**
 * Reads lifetime Singles Training stats for a user.
 */
export async function getPlayerSinglesTrainingStats(
  userId: string
): Promise<PlayerSinglesTrainingStats> {
  const rows = await db
    .select()
    .from(playerSinglesTrainingStats)
    .where(eq(playerSinglesTrainingStats.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return createEmptySinglesTrainingStats();

  return {
    gamesCompleted: row.gamesCompleted,
    gamesFailed: row.gamesFailed,
    totalDartsThrown: row.totalDartsThrown,
    totalHits: row.totalHits,
    totalScore: row.totalScore,
    dartPositionHits: [
      row.dartPositionHits[0] ?? 0,
      row.dartPositionHits[1] ?? 0,
      row.dartPositionHits[2] ?? 0,
    ],
    dartPositionAttempts: [
      row.dartPositionAttempts[0] ?? 0,
      row.dartPositionAttempts[1] ?? 0,
      row.dartPositionAttempts[2] ?? 0,
    ],
    bestHitRatio: row.bestHitRatio,
    bestScore: row.bestScore,
  };
}

/**
 * Persists lifetime Singles Training stats for a user.
 */
export async function savePlayerSinglesTrainingStats(
  userId: string,
  stats: PlayerSinglesTrainingStats
): Promise<void> {
  await db
    .insert(playerSinglesTrainingStats)
    .values({ userId, ...mapStatsToColumns(stats) })
    .onConflictDoUpdate({
      target: playerSinglesTrainingStats.userId,
      set: mapStatsToColumns(stats),
    });
}
