import { getStore } from "@netlify/blobs";
import { createInitialGameState } from "@lib/shared/games/score-training/state";
import {
  isScoreTrainingSession,
  type ScoreTrainingSession,
} from "@lib/shared/games/score-training/session";
import type { ScoreTrainingSettings } from "@lib/shared/games/score-training/settings";

const STORE_NAME = "game-sessions";
const GAME_SLUG = "score-training";

function sessionKey(userId: string): string {
  return `${userId}:${GAME_SLUG}`;
}

/**
 * Reads the active Score Training session for a user.
 */
export async function getScoreTrainingSession(
  userId: string
): Promise<ScoreTrainingSession | null> {
  const store = getStore(STORE_NAME);
  const data = await store.get(sessionKey(userId), { type: "json" });
  if (!isScoreTrainingSession(data)) return null;
  return data;
}

/**
 * Persists the current Score Training session for a user.
 */
export async function saveScoreTrainingSession(
  userId: string,
  session: ScoreTrainingSession
): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(sessionKey(userId), {
    ...session,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Removes the active Score Training session for a user.
 */
export async function deleteScoreTrainingSession(userId: string): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.delete(sessionKey(userId));
}

/**
 * Creates and saves a fresh Score Training session.
 */
export async function createScoreTrainingSession(
  userId: string,
  settings: ScoreTrainingSettings
): Promise<ScoreTrainingSession> {
  const now = new Date().toISOString();
  const session: ScoreTrainingSession = {
    slug: GAME_SLUG,
    settings,
    state: createInitialGameState(settings),
    roundHistory: [],
    timeRemainingSeconds:
      settings.endMode === "timed" ? settings.playtimeSeconds : null,
    createdAt: now,
    updatedAt: now,
  };

  await saveScoreTrainingSession(userId, session);
  return session;
}
