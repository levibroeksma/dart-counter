import { getStore } from "@netlify/blobs";
import {
  createEmptyScoreTrainingStats,
  type PlayerScoreTrainingStats,
} from "@lib/shared/games/score-training/stats";

const STORE_NAME = "player-score-training-stats";

/**
 * Reads lifetime Score Training stats for a user.
 */
export async function getPlayerScoreTrainingStats(
  userId: string
): Promise<PlayerScoreTrainingStats> {
  const store = getStore(STORE_NAME);
  const data = await store.get(userId, { type: "json" });
  return (data as PlayerScoreTrainingStats | null) ?? createEmptyScoreTrainingStats();
}

/**
 * Persists lifetime Score Training stats for a user.
 */
export async function savePlayerScoreTrainingStats(
  userId: string,
  stats: PlayerScoreTrainingStats
): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(userId, stats);
}
