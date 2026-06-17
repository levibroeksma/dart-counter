import { getStore } from "@netlify/blobs";
import { createInitialGameState } from "@lib/shared/games/singles-training/state";
import { buildTargetSequence } from "@lib/shared/games/singles-training/target-sequence";
import {
  isSinglesTrainingSession,
  type SinglesTrainingSession,
} from "@lib/shared/games/singles-training/session";
import type { SinglesTrainingSettings } from "@lib/shared/games/singles-training/settings";

const STORE_NAME = "game-sessions";
const GAME_SLUG = "singles-training";

function sessionKey(userId: string): string {
  return `${userId}:${GAME_SLUG}`;
}

/**
 * Reads the active Singles Training session for a user.
 */
export async function getSinglesTrainingSession(
  userId: string
): Promise<SinglesTrainingSession | null> {
  const store = getStore(STORE_NAME);
  const data = await store.get(sessionKey(userId), { type: "json" });
  if (!isSinglesTrainingSession(data)) return null;
  return data;
}

/**
 * Persists the current Singles Training session for a user.
 */
export async function saveSinglesTrainingSession(
  userId: string,
  session: SinglesTrainingSession
): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(sessionKey(userId), {
    ...session,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Removes the active Singles Training session for a user.
 */
export async function deleteSinglesTrainingSession(userId: string): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.delete(sessionKey(userId));
}

/**
 * Creates and saves a fresh Singles Training session.
 */
export async function createSinglesTrainingSession(
  userId: string,
  settings: SinglesTrainingSettings
): Promise<SinglesTrainingSession> {
  const now = new Date().toISOString();
  const session: SinglesTrainingSession = {
    slug: GAME_SLUG,
    settings,
    targetSequence: buildTargetSequence(settings.direction),
    state: createInitialGameState(),
    dartHistory: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveSinglesTrainingSession(userId, session);
  return session;
}
