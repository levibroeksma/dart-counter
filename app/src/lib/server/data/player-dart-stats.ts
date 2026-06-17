import { getStore } from "@netlify/blobs";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";
import type { PlayerDartStats } from "@lib/shared/stats/types";

const STORE_NAME = "player-dart-stats";

/**
 * Reads global player dart stats for a user.
 */
export async function getPlayerDartStats(
  userId: string
): Promise<PlayerDartStats> {
  const store = getStore(STORE_NAME);
  const data = await store.get(userId, { type: "json" });
  return (data as PlayerDartStats | null) ?? createEmptyPlayerDartStats();
}

/**
 * Persists global player dart stats for a user.
 */
export async function savePlayerDartStats(
  userId: string,
  stats: PlayerDartStats
): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(userId, stats);
}
