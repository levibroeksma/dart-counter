import { getStore } from "@netlify/blobs";
import {
  createEmptySinglesTrainingStats,
  type PlayerSinglesTrainingStats,
} from "@lib/shared/games/singles-training/stats";

const STORE_NAME = "player-singles-training-stats";

/**
 * Reads lifetime Singles Training stats for a user.
 */
export async function getPlayerSinglesTrainingStats(
  userId: string
): Promise<PlayerSinglesTrainingStats> {
  const store = getStore(STORE_NAME);
  const data = await store.get(userId, { type: "json" });
  return (data as PlayerSinglesTrainingStats | null) ?? createEmptySinglesTrainingStats();
}

/**
 * Persists lifetime Singles Training stats for a user.
 */
export async function savePlayerSinglesTrainingStats(
  userId: string,
  stats: PlayerSinglesTrainingStats
): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(userId, stats);
}
