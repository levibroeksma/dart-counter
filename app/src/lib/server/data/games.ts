import { eq, sql } from "drizzle-orm";
import { db, gameCatalog, gameSessions, userGamePlayCounts } from "@db/index";
import { CATALOG_ENTRY_ENV, getEntryEnv } from "@lib/shared/constants/entry-env";
import { withEntryEnv } from "@lib/server/data/entry-env";
import {
  SEED_GAMES,
  type GameConfig,
  type GameType,
} from "@lib/shared/games/types";

/**
 * Merge stored catalog with SEED_GAMES metadata by slug.
 * Seed entries win on conflict; unknown stored entries are preserved at the end.
 */
function reconcileCatalog(stored: GameType[]): GameType[] {
  const bySlug = new Map(stored.map((game) => [game.slug, game]));
  const seedSlugs = new Set(SEED_GAMES.map((game) => game.slug));

  for (const seed of SEED_GAMES) {
    bySlug.set(seed.slug, { ...bySlug.get(seed.slug), ...seed });
  }

  const merged = [
    ...SEED_GAMES.map((seed) => bySlug.get(seed.slug)!),
    ...stored.filter((game) => !seedSlugs.has(game.slug)),
  ];

  return merged;
}

function isVisibleGame(game: GameType): boolean {
  return game.enabled && game.released;
}

async function readCatalog(): Promise<GameType[]> {
  const rows = await db
    .select()
    .from(gameCatalog)
    .where(eq(gameCatalog.entryEnv, CATALOG_ENTRY_ENV));
  const stored: GameType[] = rows.map((row) => ({
    slug: row.slug,
    displayName: row.displayName,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    released: row.released,
  }));

  if (stored.length === 0) {
    await db.insert(gameCatalog).values(
      SEED_GAMES.map((g) => ({
        slug: g.slug,
        entryEnv: CATALOG_ENTRY_ENV,
        displayName: g.displayName,
        sortOrder: g.sortOrder,
        enabled: g.enabled,
        released: g.released,
      })),
    );
    return SEED_GAMES;
  }

  const merged = reconcileCatalog(stored);
  for (const game of merged) {
    await db
      .insert(gameCatalog)
      .values({
        slug: game.slug,
        entryEnv: CATALOG_ENTRY_ENV,
        displayName: game.displayName,
        sortOrder: game.sortOrder,
        enabled: game.enabled,
        released: game.released,
      })
      .onConflictDoUpdate({
        target: gameCatalog.slug,
        set: {
          displayName: game.displayName,
          sortOrder: game.sortOrder,
          enabled: game.enabled,
          released: game.released,
        },
      });
  }
  return merged;
}

/**
 * Return all released, enabled game types sorted by sortOrder.
 */
export async function getGameTypes(): Promise<GameType[]> {
  const catalog = await readCatalog();
  return catalog
    .filter(isVisibleGame)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Look up a single released, enabled game by slug.
 */
export async function getGameBySlug(slug: string): Promise<GameType | null> {
  const games = await getGameTypes();
  return games.find((game) => game.slug === slug) ?? null;
}

/**
 * Return top N games by play count, falling back to catalog order.
 */
export async function getQuickStartGames(
  userId: string,
  limit: number
): Promise<GameType[]> {
  const catalog = await getGameTypes();
  const rows = await db
    .select()
    .from(userGamePlayCounts)
    .where(withEntryEnv(userGamePlayCounts.entryEnv, eq(userGamePlayCounts.userId, userId)));

  const playCounts: Record<string, number> = {};
  for (const row of rows) {
    playCounts[row.gameSlug] = row.playCount;
  }

  const ranked = [...catalog].sort((a, b) => {
    const aCount = playCounts[a.slug] ?? 0;
    const bCount = playCounts[b.slug] ?? 0;
    if (bCount !== aCount) return bCount - aCount;
    return a.sortOrder - b.sortOrder;
  });

  const hasPlays = catalog.some(
    (game) => (playCounts[game.slug] ?? 0) > 0
  );
  if (!hasPlays) {
    return catalog.slice(0, limit);
  }

  return ranked.slice(0, limit);
}

/**
 * Persist per-user game session config before play.
 */
export async function saveGameConfig(
  userId: string,
  slug: string,
  settings: Record<string, unknown>
): Promise<GameConfig> {
  const now = new Date();
  const config: GameConfig = {
    slug,
    settings,
    updatedAt: now.toISOString(),
  };
  await db
    .insert(gameSessions)
    .values({
      userId,
      gameSlug: slug,
      entryEnv: getEntryEnv(),
      sessionData: config,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [gameSessions.userId, gameSessions.gameSlug, gameSessions.entryEnv],
      set: { sessionData: config, updatedAt: new Date() },
    });
  return config;
}

/**
 * Read saved session config for a user and game slug.
 */
export async function getGameConfig(
  userId: string,
  slug: string
): Promise<GameConfig | null> {
  const rows = await db
    .select()
    .from(gameSessions)
    .where(
      withEntryEnv(
        gameSessions.entryEnv,
        eq(gameSessions.userId, userId),
        eq(gameSessions.gameSlug, slug),
      ),
    )
    .limit(1);
  const data = rows[0]?.sessionData;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (!record.settings || typeof record.settings !== "object") return null;
  return data as GameConfig;
}

/**
 * Increment play count for a user/game pair.
 */
export async function incrementPlayCount(
  userId: string,
  slug: string
): Promise<void> {
  await db
    .insert(userGamePlayCounts)
    .values({ userId, gameSlug: slug, entryEnv: getEntryEnv(), playCount: 1 })
    .onConflictDoUpdate({
      target: [
        userGamePlayCounts.userId,
        userGamePlayCounts.gameSlug,
        userGamePlayCounts.entryEnv,
      ],
      set: { playCount: sql`${userGamePlayCounts.playCount} + 1` },
    });
}
