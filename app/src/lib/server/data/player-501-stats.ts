import { eq } from "drizzle-orm";
import { db, player501Stats } from "@db/index";
import { getEntryEnv } from "@lib/shared/constants/entry-env";
import { withEntryEnv } from "@lib/server/data/entry-env";
import {
  createEmpty501Stats,
  type Player501Stats,
} from "@lib/shared/games/501/stats";

function mapStatsToColumns(stats: Player501Stats) {
  return {
    gamesCompleted: stats.gamesCompleted,
    gamesWon: stats.gamesWon,
    totalDartsThrown: stats.totalDartsThrown,
    totalCheckouts: stats.totalCheckouts,
    bestLegAverage: stats.bestLegAverage,
    bestMatchAverage: stats.bestMatchAverage,
  };
}

/**
 * Reads lifetime 501 stats for a user.
 */
export async function getPlayer501Stats(userId: string): Promise<Player501Stats> {
  const rows = await db
    .select()
    .from(player501Stats)
    .where(withEntryEnv(player501Stats.entryEnv, eq(player501Stats.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return createEmpty501Stats();

  return {
    gamesCompleted: row.gamesCompleted,
    gamesWon: row.gamesWon,
    totalDartsThrown: row.totalDartsThrown,
    totalCheckouts: row.totalCheckouts,
    bestLegAverage: row.bestLegAverage,
    bestMatchAverage: row.bestMatchAverage,
  };
}

/**
 * Persists lifetime 501 stats for a user.
 */
export async function savePlayer501Stats(
  userId: string,
  stats: Player501Stats,
): Promise<void> {
  await db
    .insert(player501Stats)
    .values({ userId, entryEnv: getEntryEnv(), ...mapStatsToColumns(stats) })
    .onConflictDoUpdate({
      target: [player501Stats.userId, player501Stats.entryEnv],
      set: mapStatsToColumns(stats),
    });
}
