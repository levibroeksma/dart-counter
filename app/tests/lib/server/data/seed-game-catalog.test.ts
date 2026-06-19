import { describe, it, expect, beforeEach } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb } from "@tests/helpers/mock-db";
import { seedGameCatalog } from "@lib/server/data/seed-game-catalog";
import { SEED_GAMES } from "@lib/shared/games/types";
import { CATALOG_ENTRY_ENV } from "@lib/shared/constants/entry-env";

describe("seedGameCatalog", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("inserts all seed games when catalog is empty", async () => {
    await seedGameCatalog();

    expect(mockDb.tables.gameCatalog.size).toBe(SEED_GAMES.length);
    for (const game of SEED_GAMES) {
      expect(mockDb.tables.gameCatalog.get(game.slug)).toMatchObject({
        slug: game.slug,
        entryEnv: CATALOG_ENTRY_ENV,
        displayName: game.displayName,
        sortOrder: game.sortOrder,
        enabled: game.enabled,
        released: game.released,
      });
    }
  });

  it("upserts stale rows to match seed metadata", async () => {
    mockDb.tables.gameCatalog.set("score-training", {
      slug: "score-training",
      entryEnv: CATALOG_ENTRY_ENV,
      displayName: "Old Name",
      sortOrder: 99,
      enabled: false,
      released: false,
    });

    await seedGameCatalog();

    expect(mockDb.tables.gameCatalog.get("score-training")).toMatchObject({
      displayName: "Score Training",
      sortOrder: 4,
      enabled: true,
      released: true,
    });
  });
});
