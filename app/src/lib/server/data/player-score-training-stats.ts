import { eq } from "drizzle-orm";
import { db, playerScoreTrainingStats } from "@db/index";
import { getEntryEnv } from "@lib/shared/constants/entry-env";
import { withEntryEnv } from "@lib/server/data/entry-env";
import {
  createEmptyScoreTrainingStats,
  type PlayerScoreTrainingStats,
} from "@lib/shared/games/score-training/stats";

function mapStatsToColumns(stats: PlayerScoreTrainingStats) {
  return {
    gamesCompleted: stats.gamesCompleted,
    totalDartsThrown: stats.totalDartsThrown,
    totalPointsScored: stats.totalPointsScored,
    bestVisitScore: stats.bestVisitScore,
    bestGameAverage: stats.bestGameAverage,
  };
}

/**
 * Reads lifetime Score Training stats for a user.
 */
export async function getPlayerScoreTrainingStats(
  userId: string
): Promise<PlayerScoreTrainingStats> {
  const rows = await db
    .select()
    .from(playerScoreTrainingStats)
    .where(
      withEntryEnv(
        playerScoreTrainingStats.entryEnv,
        eq(playerScoreTrainingStats.userId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return createEmptyScoreTrainingStats();

  return {
    gamesCompleted: row.gamesCompleted,
    totalDartsThrown: row.totalDartsThrown,
    totalPointsScored: row.totalPointsScored,
    bestVisitScore: row.bestVisitScore,
    bestGameAverage: row.bestGameAverage,
  };
}

/**
 * Persists lifetime Score Training stats for a user.
 */
export async function savePlayerScoreTrainingStats(
  userId: string,
  stats: PlayerScoreTrainingStats
): Promise<void> {
  await db
    .insert(playerScoreTrainingStats)
    .values({ userId, entryEnv: getEntryEnv(), ...mapStatsToColumns(stats) })
    .onConflictDoUpdate({
      target: [playerScoreTrainingStats.userId, playerScoreTrainingStats.entryEnv],
      set: mapStatsToColumns(stats),
    });
}
