import { describe, it, expect, beforeEach } from "vitest";

import "@tests/helpers/mock-db";
import { mockDb, playCountScopedKey, sessionScopedKey, TEST_ENTRY_ENV } from "@tests/helpers/mock-db";
import {
  getGameTypes,
  getGameBySlug,
  getQuickStartGames,
  saveGameConfig,
  getGameConfig,
  incrementPlayCount,
} from "@lib/server/data/games";
import { CATALOG_ENTRY_ENV } from "@lib/shared/constants/entry-env";
import { SEED_GAMES, type GameType } from "@lib/shared/games/types";

const RELEASED_GAMES = SEED_GAMES.filter((g) => g.released);

function seedPlayCounts(
  userId: string,
  counts: Record<string, number>,
): void {
  for (const [gameSlug, playCount] of Object.entries(counts)) {
    mockDb.tables.userGamePlayCounts.set(playCountScopedKey(userId, gameSlug), {
      userId,
      gameSlug,
      entryEnv: TEST_ENTRY_ENV,
      playCount,
    });
  }
}
function seedCatalog(games: GameType[] = SEED_GAMES): void {
  for (const game of games) {
    mockDb.tables.gameCatalog.set(game.slug, {
      slug: game.slug,
      entryEnv: CATALOG_ENTRY_ENV,
      displayName: game.displayName,
      sortOrder: game.sortOrder,
      enabled: game.enabled,
      released: game.released,
    });
  }
}

describe("games data layer", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("returns seed games when store is empty without writing catalog", async () => {
    const games = await getGameTypes();
    expect(games).toEqual(RELEASED_GAMES);
    expect(mockDb.tables.gameCatalog.size).toBe(0);
  });

  it("getGameBySlug returns released game", async () => {
    seedCatalog();
    const game = await getGameBySlug("ten-up-one-down");
    expect(game?.slug).toBe("ten-up-one-down");
  });

  it("getGameBySlug returns score-training from catalog", async () => {
    seedCatalog();
    const game = await getGameBySlug("score-training");
    expect(game).toEqual({
      slug: "score-training",
      displayName: "Score Training",
      sortOrder: 4,
      enabled: true,
      released: true,
    });
  });

  it("getGameBySlug returns singles-training from catalog", async () => {
    seedCatalog();
    const game = await getGameBySlug("singles-training");
    expect(game).toEqual({
      slug: "singles-training",
      displayName: "Singles Training",
      sortOrder: 5,
      enabled: true,
      released: true,
    });
  });

  it("getGameBySlug returns null for unknown slug", async () => {
    seedCatalog();
    await expect(getGameBySlug("invalid")).resolves.toBeNull();
  });

  it("getQuickStartGames falls back to first N when no stats", async () => {
    seedCatalog();
    const games = await getQuickStartGames("alex", 2);
    expect(games.map((g) => g.slug)).toEqual(["ten-up-one-down", "score-training"]);
  });

  it("getQuickStartGames sorts by play count when stats exist", async () => {
    seedCatalog();
    seedPlayCounts("alex", {
      "score-training": 5,
      "ten-up-one-down": 2,
    });
    const games = await getQuickStartGames("alex", 2);
    expect(games.map((g) => g.slug)).toEqual(["score-training", "ten-up-one-down"]);
  });

  it("saveGameConfig and getGameConfig round-trip", async () => {
    await saveGameConfig("alex", "501", { startingScore: 501 });
    const config = await getGameConfig("alex", "501");
    expect(config?.settings).toEqual({ startingScore: 501 });
    expect(config?.slug).toBe("501");
    expect(mockDb.tables.gameSessions.get(sessionScopedKey("alex", "501"))?.gameSlug).toBe("501");
  });

  it("incrementPlayCount updates user stats", async () => {
    mockDb.tables.userGamePlayCounts.set(playCountScopedKey("alex", "501"), {
      userId: "alex",
      gameSlug: "501",
      entryEnv: TEST_ENTRY_ENV,
      playCount: 1,
    });
    await incrementPlayCount("alex", "501");
    expect(mockDb.tables.userGamePlayCounts.get(playCountScopedKey("alex", "501"))?.playCount).toBe(2);
  });

  it("merges missing seed games in memory when catalog is stale", async () => {
    const staleCatalog = SEED_GAMES.filter((g) => g.slug !== "score-training");
    seedCatalog(staleCatalog);

    const games = await getGameTypes();

    expect(games.map((g) => g.slug)).toContain("score-training");
    expect(games).toEqual(RELEASED_GAMES);
    expect(mockDb.tables.gameCatalog.has("score-training")).toBe(false);
  });

  it("merges missing singles-training in memory when catalog is stale", async () => {
    const staleCatalog = SEED_GAMES.filter((g) => g.slug !== "singles-training");
    seedCatalog(staleCatalog);

    const games = await getGameTypes();

    expect(games.map((g) => g.slug)).toContain("singles-training");
    expect(games).toEqual(RELEASED_GAMES);
    expect(mockDb.tables.gameCatalog.has("singles-training")).toBe(false);
  });

  it("does not mutate catalog table on read when already seeded", async () => {
    seedCatalog();
    const before = [...mockDb.tables.gameCatalog.values()];

    await getGameTypes();

    const after = [...mockDb.tables.gameCatalog.values()];
    expect(after).toEqual(before);
  });

  it("getGameTypes returns only released games", async () => {
    seedCatalog();
    const games = await getGameTypes();
    expect(games.map((g) => g.slug)).toEqual([
      "ten-up-one-down",
      "score-training",
      "singles-training",
    ]);
  });

  it("getGameBySlug returns null for unreleased game", async () => {
    seedCatalog();
    await expect(getGameBySlug("501")).resolves.toBeNull();
  });
});
