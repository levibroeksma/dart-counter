import { and, eq } from "drizzle-orm";
import { db, gameSessions } from "@db/index";
import { createInitialGameState } from "@lib/shared/games/score-training/state";
import {
  isScoreTrainingSession,
  type ScoreTrainingSession,
} from "@lib/shared/games/score-training/session";
import type { ScoreTrainingSettings } from "@lib/shared/games/score-training/settings";

const GAME_SLUG = "score-training";

/**
 * Reads the active Score Training session for a user.
 */
export async function getScoreTrainingSession(
  userId: string
): Promise<ScoreTrainingSession | null> {
  const rows = await db
    .select()
    .from(gameSessions)
    .where(
      and(eq(gameSessions.userId, userId), eq(gameSessions.gameSlug, GAME_SLUG))
    )
    .limit(1);
  const data = rows[0]?.sessionData;
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
  const updatedSession: ScoreTrainingSession = {
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
 * Removes the active Score Training session for a user.
 */
export async function deleteScoreTrainingSession(userId: string): Promise<void> {
  await db
    .delete(gameSessions)
    .where(
      and(eq(gameSessions.userId, userId), eq(gameSessions.gameSlug, GAME_SLUG))
    );
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
