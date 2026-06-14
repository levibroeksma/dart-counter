import { getStore } from "@netlify/blobs";
import {
  SEED_GAMES,
  type GameConfig,
  type GameType,
  type UserGameStats,
} from "@lib/shared/games/types";

const CATALOG_STORE = "game-types";
const CATALOG_KEY = "catalog";
const STATS_STORE = "user-game-stats";
const SESSIONS_STORE = "game-sessions";

async function readCatalog(): Promise<GameType[]> {
  const store = getStore(CATALOG_STORE);
  const data = await store.get(CATALOG_KEY, { type: "json" });
  if (!data) {
    await store.setJSON(CATALOG_KEY, SEED_GAMES);
    return SEED_GAMES;
  }
  return data as GameType[];
}

/**
 * Return all enabled game types sorted by sortOrder.
 */
export async function getGameTypes(): Promise<GameType[]> {
  const catalog = await readCatalog();
  return catalog
    .filter((game) => game.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Look up a single enabled game by slug.
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

  const hasPlays = Object.values(stats.playCounts).some((count) => count > 0);
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
