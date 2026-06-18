import { and, eq } from "drizzle-orm";
import { db, gameSessions } from "@db/index";
import { createInitialGameState } from "@lib/shared/games/singles-training/state";
import { buildTargetSequence } from "@lib/shared/games/singles-training/target-sequence";
import {
  isSinglesTrainingSession,
  type SinglesTrainingSession,
} from "@lib/shared/games/singles-training/session";
import type { SinglesTrainingSettings } from "@lib/shared/games/singles-training/settings";

const GAME_SLUG = "singles-training";

/**
 * Reads the active Singles Training session for a user.
 */
export async function getSinglesTrainingSession(
  userId: string
): Promise<SinglesTrainingSession | null> {
  const rows = await db
    .select()
    .from(gameSessions)
    .where(
      and(eq(gameSessions.userId, userId), eq(gameSessions.gameSlug, GAME_SLUG))
    )
    .limit(1);
  const data = rows[0]?.sessionData;
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
  const updatedSession: SinglesTrainingSession = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(gameSessions)
    .values({
      userId,
      gameSlug: GAME_SLUG,
      sessionData: updatedSession,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [gameSessions.userId, gameSessions.gameSlug],
      set: { sessionData: updatedSession, updatedAt: new Date() },
    });
}

/**
 * Removes the active Singles Training session for a user.
 */
export async function deleteSinglesTrainingSession(userId: string): Promise<void> {
  await db
    .delete(gameSessions)
    .where(
      and(eq(gameSessions.userId, userId), eq(gameSessions.gameSlug, GAME_SLUG))
    );
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
