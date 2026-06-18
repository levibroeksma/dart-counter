import { eq } from "drizzle-orm";
import { db, gameSessions } from "@db/index";
import { getEntryEnv } from "@lib/shared/constants/entry-env";
import { withEntryEnv } from "@lib/server/data/entry-env";
import { createInitialGameState } from "@lib/shared/games/ten-up-one-down/state";
import {
  isTenUpOneDownSession,
  type TenUpOneDownSession,
} from "@lib/shared/games/ten-up-one-down/session";
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";

const GAME_SLUG = "ten-up-one-down";

/**
 * Reads the active Ten Up One Down session for a user.
 */
export async function getTenUpOneDownSession(
  userId: string
): Promise<TenUpOneDownSession | null> {
  const rows = await db
    .select()
    .from(gameSessions)
    .where(
      withEntryEnv(
        gameSessions.entryEnv,
        eq(gameSessions.userId, userId),
        eq(gameSessions.gameSlug, GAME_SLUG),
      ),
    )
    .limit(1);
  const data = rows[0]?.sessionData;
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
  const updatedSession: TenUpOneDownSession = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(gameSessions)
    .values({
      userId,
      gameSlug: GAME_SLUG,
      entryEnv: getEntryEnv(),
      sessionData: updatedSession,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [gameSessions.userId, gameSessions.gameSlug, gameSessions.entryEnv],
      set: { sessionData: updatedSession, updatedAt: new Date() },
    });
}

/**
 * Removes the active Ten Up One Down session for a user.
 */
export async function deleteTenUpOneDownSession(userId: string): Promise<void> {
  await db
    .delete(gameSessions)
    .where(
      withEntryEnv(
        gameSessions.entryEnv,
        eq(gameSessions.userId, userId),
        eq(gameSessions.gameSlug, GAME_SLUG),
      ),
    );
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
