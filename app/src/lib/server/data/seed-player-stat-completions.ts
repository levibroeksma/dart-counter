import { eq } from "drizzle-orm";
import { db, playerStatCompletions } from "@db/index";
import { withEntryEnv } from "@lib/server/data/entry-env";
import { createEmpty501Stats } from "@lib/shared/games/501";
import { createEmptyScoreTrainingStats } from "@lib/shared/games/score-training";
import type { StatCompletionRecord } from "@lib/shared/stats";
import { insertPlayerStatCompletion } from "@lib/server/data/player-stat-completions";
import { savePlayer501Stats } from "@lib/server/data/player-501-stats";
import { savePlayerScoreTrainingStats } from "@lib/server/data/player-score-training-stats";
import { setPreferences } from "@lib/server/data/preferences";

type SeedCompletion = Omit<StatCompletionRecord, "id">;

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString();
}

/** Demo completions spread across the last 30 days for homepage sparklines. */
export function buildDevStatCompletionSeed(): SeedCompletion[] {
  return [
    {
      gameSlug: "501",
      completedAt: daysAgo(26),
      pointsScored: 450,
      dartsThrown: 30,
      scoringPoints: 450,
      scoringVisits: 15,
      doubleAttempts: 3,
      doubleHits: 1,
      visits100Plus: 4,
      visits120Plus: 2,
      visits140Plus: 1,
      visits180: 1,
      segmentHits: 0,
      segmentAttempts: 0,
    },
    {
      gameSlug: "501",
      completedAt: daysAgo(20),
      pointsScored: 501,
      dartsThrown: 18,
      scoringPoints: 501,
      scoringVisits: 9,
      doubleAttempts: 2,
      doubleHits: 1,
      visits100Plus: 3,
      visits120Plus: 2,
      visits140Plus: 1,
      visits180: 2,
      segmentHits: 0,
      segmentAttempts: 0,
    },
    {
      gameSlug: "score-training",
      completedAt: daysAgo(16),
      pointsScored: 0,
      dartsThrown: 0,
      scoringPoints: 320,
      scoringVisits: 8,
      doubleAttempts: 0,
      doubleHits: 0,
      visits100Plus: 2,
      visits120Plus: 1,
      visits140Plus: 0,
      visits180: 0,
      segmentHits: 0,
      segmentAttempts: 0,
    },
    {
      gameSlug: "501",
      completedAt: daysAgo(12),
      pointsScored: 280,
      dartsThrown: 27,
      scoringPoints: 280,
      scoringVisits: 12,
      doubleAttempts: 4,
      doubleHits: 0,
      visits100Plus: 1,
      visits120Plus: 0,
      visits140Plus: 0,
      visits180: 0,
      segmentHits: 0,
      segmentAttempts: 0,
    },
    {
      gameSlug: "ten-up-one-down",
      completedAt: daysAgo(9),
      pointsScored: 0,
      dartsThrown: 0,
      scoringPoints: 0,
      scoringVisits: 0,
      doubleAttempts: 12,
      doubleHits: 4,
      visits100Plus: 0,
      visits120Plus: 0,
      visits140Plus: 0,
      visits180: 0,
      segmentHits: 0,
      segmentAttempts: 0,
    },
    {
      gameSlug: "score-training",
      completedAt: daysAgo(5),
      pointsScored: 0,
      dartsThrown: 0,
      scoringPoints: 264,
      scoringVisits: 6,
      doubleAttempts: 0,
      doubleHits: 0,
      visits100Plus: 3,
      visits120Plus: 1,
      visits140Plus: 0,
      visits180: 0,
      segmentHits: 0,
      segmentAttempts: 0,
    },
    {
      gameSlug: "501",
      completedAt: daysAgo(2),
      pointsScored: 501,
      dartsThrown: 15,
      scoringPoints: 501,
      scoringVisits: 8,
      doubleAttempts: 2,
      doubleHits: 1,
      visits100Plus: 4,
      visits120Plus: 3,
      visits140Plus: 2,
      visits180: 1,
      segmentHits: 0,
      segmentAttempts: 0,
    },
  ];
}

async function clearDevStatCompletions(userId: string): Promise<void> {
  await db
    .delete(playerStatCompletions)
    .where(
      withEntryEnv(
        playerStatCompletions.entryEnv,
        eq(playerStatCompletions.userId, userId),
      ),
    );
}

/**
 * Seeds demo profile stats for local chart validation.
 * Replaces existing completion rows for the user in the current entry env.
 */
export async function seedPlayerStatCompletions(
  userId: string,
  options: { displayName?: string } = {},
): Promise<{ completionsInserted: number }> {
  await clearDevStatCompletions(userId);

  const completions = buildDevStatCompletionSeed();
  for (const completion of completions) {
    await insertPlayerStatCompletion(userId, completion);
  }

  const stats501 = createEmpty501Stats();
  stats501.gamesCompleted = 4;
  stats501.gamesWon = 2;
  stats501.totalDartsThrown = 90;
  stats501.totalCheckouts = 3;
  stats501.bestLegAverage = 112.4;
  stats501.bestMatchAverage = 98.7;
  await savePlayer501Stats(userId, stats501);

  const scoreTraining = createEmptyScoreTrainingStats();
  scoreTraining.gamesCompleted = 2;
  scoreTraining.totalDartsThrown = 42;
  scoreTraining.totalPointsScored = 584;
  scoreTraining.bestVisitScore = 140;
  scoreTraining.bestGameAverage = 48.7;
  await savePlayerScoreTrainingStats(userId, scoreTraining);

  await setPreferences(userId, {
    displayName: options.displayName ?? "Levi",
  });

  return { completionsInserted: completions.length };
}
