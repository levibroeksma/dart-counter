import { asc, eq } from "drizzle-orm";
import { db, playerStatCompletions } from "@db/index";
import { getEntryEnv } from "@lib/shared/constants/entry-env";
import { withEntryEnv } from "@lib/server/data/entry-env";
import {
  computeProfileMetrics,
  computeSparklineSeries,
  type MetricKind,
  type ProfileMetrics,
  type SparklineSeries,
  type StatCompletionRecord,
} from "@lib/shared/stats";
import { getPlayer501Stats } from "@lib/server/data/player-501-stats";
import { getPlayerScoreTrainingStats } from "@lib/server/data/player-score-training-stats";
import { getPlayerSinglesTrainingStats } from "@lib/server/data/player-singles-training-stats";

export type ProfileDashboardData = {
  metrics: ProfileMetrics;
  sparklines: SparklineSeries[];
  gamesPlayed: number;
  gamesWon: number;
};

const METRIC_KINDS: MetricKind[] = [
  "threeDartAverage",
  "scoringAverage",
  "checkoutPercentage",
];

function mapRow(row: typeof playerStatCompletions.$inferSelect): StatCompletionRecord {
  return {
    id: row.id,
    gameSlug: row.gameSlug,
    completedAt: row.completedAt.toISOString(),
    pointsScored: row.pointsScored,
    dartsThrown: row.dartsThrown,
    scoringPoints: row.scoringPoints,
    scoringVisits: row.scoringVisits,
    doubleAttempts: row.doubleAttempts,
    doubleHits: row.doubleHits,
    visits100Plus: row.visits100Plus,
    visits120Plus: row.visits120Plus,
    visits140Plus: row.visits140Plus,
    visits180: row.visits180,
    segmentHits: row.segmentHits,
    segmentAttempts: row.segmentAttempts,
  };
}

/**
 * Persists a completed game snapshot used by profile metric charts.
 */
export async function insertPlayerStatCompletion(
  userId: string,
  snapshot: Omit<StatCompletionRecord, "id" | "completedAt"> & {
    completedAt?: string;
  },
): Promise<void> {
  await db.insert(playerStatCompletions).values({
    userId,
    entryEnv: getEntryEnv(),
    gameSlug: snapshot.gameSlug,
    completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : undefined,
    pointsScored: snapshot.pointsScored,
    dartsThrown: snapshot.dartsThrown,
    scoringPoints: snapshot.scoringPoints,
    scoringVisits: snapshot.scoringVisits,
    doubleAttempts: snapshot.doubleAttempts,
    doubleHits: snapshot.doubleHits,
    visits100Plus: snapshot.visits100Plus,
    visits120Plus: snapshot.visits120Plus,
    visits140Plus: snapshot.visits140Plus,
    visits180: snapshot.visits180,
    segmentHits: snapshot.segmentHits,
    segmentAttempts: snapshot.segmentAttempts,
  });
}

/**
 * Reads completion snapshots ordered chronologically.
 */
export async function getPlayerStatCompletions(
  userId: string,
): Promise<StatCompletionRecord[]> {
  const rows = await db
    .select()
    .from(playerStatCompletions)
    .where(
      withEntryEnv(
        playerStatCompletions.entryEnv,
        eq(playerStatCompletions.userId, userId),
      ),
    )
    .orderBy(asc(playerStatCompletions.completedAt));
  return rows.map(mapRow);
}

/**
 * Builds profile metrics, sparklines, and game counters for the dashboard.
 */
export async function getProfileDashboardData(
  userId: string,
): Promise<ProfileDashboardData> {
  const [completions, stats501, scoreTraining, singles] = await Promise.all([
    getPlayerStatCompletions(userId),
    getPlayer501Stats(userId),
    getPlayerScoreTrainingStats(userId),
    getPlayerSinglesTrainingStats(userId),
  ]);

  const tuodGames = completions.filter(
    (completion) => completion.gameSlug === "ten-up-one-down",
  ).length;
  const gamesPlayed =
    stats501.gamesCompleted +
    scoreTraining.gamesCompleted +
    singles.gamesCompleted +
    tuodGames;

  return {
    metrics: computeProfileMetrics(completions),
    sparklines: METRIC_KINDS.map((kind) =>
      computeSparklineSeries(completions, kind),
    ),
    gamesPlayed,
    gamesWon: stats501.gamesWon,
  };
}
