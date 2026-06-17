import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSetJSON = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn((name: string) => ({
    get: (...args: unknown[]) => mockGet(name, ...args),
    setJSON: (...args: unknown[]) => mockSetJSON(name, ...args),
  })),
}));

import {
  getGameTypes,
  getGameBySlug,
  getQuickStartGames,
  saveGameConfig,
  getGameConfig,
  incrementPlayCount,
} from "@lib/server/data/games";
import { SEED_GAMES } from "@lib/shared/games/types";

const RELEASED_GAMES = SEED_GAMES.filter((g) => g.released);

describe("games data layer", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetJSON.mockReset();
  });

  it("seeds catalog when store is empty", async () => {
    mockGet.mockResolvedValue(null);
    const games = await getGameTypes();
    expect(games).toEqual(RELEASED_GAMES);
    expect(mockSetJSON).toHaveBeenCalledWith("game-types", "catalog", SEED_GAMES);
  });

  it("getGameBySlug returns released game", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    const game = await getGameBySlug("ten-up-one-down");
    expect(game?.slug).toBe("ten-up-one-down");
  });

  it("getGameBySlug returns score-training from catalog", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    const game = await getGameBySlug("score-training");
    expect(game).toEqual({
      slug: "score-training",
      displayName: "Score Training",
      sortOrder: 4,
      enabled: true,
      released: true,
    });
  });

  it("getGameBySlug returns null for unknown slug", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    await expect(getGameBySlug("invalid")).resolves.toBeNull();
  });

  it("getQuickStartGames falls back to first N when no stats", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      if (store === "user-game-stats") return Promise.resolve(null);
      return Promise.resolve(null);
    });
    const games = await getQuickStartGames("alex", 2);
    expect(games.map((g) => g.slug)).toEqual(["ten-up-one-down", "score-training"]);
  });

  it("getQuickStartGames sorts by play count when stats exist", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      if (store === "user-game-stats" && key === "alex") {
        return Promise.resolve({
          playCounts: { "score-training": 5, "ten-up-one-down": 2 },
        });
      }
      return Promise.resolve(null);
    });
    const games = await getQuickStartGames("alex", 2);
    expect(games.map((g) => g.slug)).toEqual(["score-training", "ten-up-one-down"]);
  });

  it("saveGameConfig and getGameConfig round-trip", async () => {
    const saved: Record<string, unknown> = {};
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-sessions" && key === "alex:501") {
        return Promise.resolve(saved[key] ?? null);
      }
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    mockSetJSON.mockImplementation((store: string, key: string, value: unknown) => {
      if (store === "game-sessions") saved[key] = value;
      return Promise.resolve();
    });

    await saveGameConfig("alex", "501", { startingScore: 501 });
    const config = await getGameConfig("alex", "501");
    expect(config?.settings).toEqual({ startingScore: 501 });
    expect(config?.slug).toBe("501");
  });

  it("incrementPlayCount updates user stats", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "user-game-stats" && key === "alex") {
        return Promise.resolve({ playCounts: { "501": 1 } });
      }
      return Promise.resolve(null);
    });
    await incrementPlayCount("alex", "501");
    expect(mockSetJSON).toHaveBeenCalledWith(
      "user-game-stats",
      "alex",
      { playCounts: { "501": 2 } }
    );
  });

  it("reconciles stale catalog missing score-training", async () => {
    const staleCatalog = SEED_GAMES.filter((g) => g.slug !== "score-training");
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(staleCatalog);
      return Promise.resolve(null);
    });

    const games = await getGameTypes();

    expect(games.map((g) => g.slug)).toContain("score-training");
    expect(mockSetJSON).toHaveBeenCalledWith("game-types", "catalog", SEED_GAMES);
    expect(games).toEqual(RELEASED_GAMES);
  });

  it("reconciliation is idempotent when catalog already matches seed", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });

    await getGameTypes();
    expect(mockSetJSON).not.toHaveBeenCalled();
  });

  it("getGameTypes returns only released games", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    const games = await getGameTypes();
    expect(games.map((g) => g.slug)).toEqual([
      "ten-up-one-down",
      "score-training",
    ]);
  });

  it("getGameBySlug returns null for unreleased game", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    await expect(getGameBySlug("501")).resolves.toBeNull();
  });
});
