import { getStore } from "@netlify/blobs";
import { db, gameCatalog } from "@db/index";
import {
  SEED_GAMES,
  type GameConfig,
  type GameType,
  type UserGameStats,
} from "@lib/shared/games/types";

const STATS_STORE = "user-game-stats";
const SESSIONS_STORE = "game-sessions";

/**
 * Merge stored catalog with SEED_GAMES metadata by slug.
 * Seed entries win on conflict; unknown stored entries are preserved at the end.
 */
export function reconcileCatalog(stored: GameType[]): GameType[] {
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
  const rows = await db.select().from(gameCatalog);
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
  const store = getStore(STATS_STORE);
  const stats =
    ((await store.get(userId, { type: "json" })) as UserGameStats | null) ??
    { playCounts: {} };

  const ranked = [...catalog].sort((a, b) => {
    const aCount = stats.playCounts[a.slug] ?? 0;
    const bCount = stats.playCounts[b.slug] ?? 0;
    if (bCount !== aCount) return bCount - aCount;
    return a.sortOrder - b.sortOrder;
  });

  const hasPlays = catalog.some(
    (game) => (stats.playCounts[game.slug] ?? 0) > 0
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
  const config: GameConfig = {
    slug,
    settings,
    updatedAt: new Date().toISOString(),
  };
  const store = getStore(SESSIONS_STORE);
  await store.setJSON(`${userId}:${slug}`, config);
  return config;
}

/**
 * Read saved session config for a user and game slug.
 */
export async function getGameConfig(
  userId: string,
  slug: string
): Promise<GameConfig | null> {
  const store = getStore(SESSIONS_STORE);
  const data = await store.get(`${userId}:${slug}`, { type: "json" });
  return (data as GameConfig | null) ?? null;
}

/**
 * Increment play count for a user/game pair.
 */
export async function incrementPlayCount(
  userId: string,
  slug: string
): Promise<void> {
  const store = getStore(STATS_STORE);
  const existing =
    ((await store.get(userId, { type: "json" })) as UserGameStats | null) ??
    { playCounts: {} };
  const playCounts = { ...existing.playCounts };
  playCounts[slug] = (playCounts[slug] ?? 0) + 1;
  await store.setJSON(userId, { playCounts });
}
