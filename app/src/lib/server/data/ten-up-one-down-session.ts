import { getStore } from "@netlify/blobs";
import { createInitialGameState } from "@lib/shared/games/ten-up-one-down/state";
import {
  isTenUpOneDownSession,
  type TenUpOneDownSession,
} from "@lib/shared/games/ten-up-one-down/session";
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";

const STORE_NAME = "game-sessions";
const GAME_SLUG = "ten-up-one-down";

function sessionKey(userId: string): string {
  return `${userId}:${GAME_SLUG}`;
}

/**
 * Reads the active Ten Up One Down session for a user.
 */
export async function getTenUpOneDownSession(
  userId: string
): Promise<TenUpOneDownSession | null> {
  const store = getStore(STORE_NAME);
  const data = await store.get(sessionKey(userId), { type: "json" });
  if (!isTenUpOneDownSession(data)) return null;
  return data;
}

/**
 * Persists the current Ten Up One Down session for a user.
 */
export async function saveTenUpOneDownSession(
  userId: string,
  session: TenUpOneDownSession
): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(sessionKey(userId), {
    ...session,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Removes the active Ten Up One Down session for a user.
 */
export async function deleteTenUpOneDownSession(userId: string): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.delete(sessionKey(userId));
}

/**
 * Creates and saves a fresh Ten Up One Down session.
 */
export async function createTenUpOneDownSession(
  userId: string,
  settings: TenUpOneDownSettings
): Promise<TenUpOneDownSession> {
  const now = new Date().toISOString();
  const session: TenUpOneDownSession = {
    slug: GAME_SLUG,
    settings,
    state: createInitialGameState(settings),
    roundHistory: [],
    timeRemainingSeconds:
      settings.endMode === "timed" ? settings.playtimeSeconds : null,
    createdAt: now,
    updatedAt: now,
  };

  await saveTenUpOneDownSession(userId, session);
  return session;
}
