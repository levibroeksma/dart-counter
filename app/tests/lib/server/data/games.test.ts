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

describe("games data layer", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetJSON.mockReset();
  });

  it("seeds catalog when store is empty", async () => {
    mockGet.mockResolvedValue(null);
    const games = await getGameTypes();
    expect(games).toEqual(SEED_GAMES);
    expect(mockSetJSON).toHaveBeenCalledWith("game-types", "catalog", SEED_GAMES);
  });

  it("getGameBySlug returns enabled game", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    const game = await getGameBySlug("501");
    expect(game?.slug).toBe("501");
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
    expect(games.map((g) => g.slug)).toEqual(["501", "ten-up-one-down"]);
  });

  it("getQuickStartGames sorts by play count when stats exist", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      if (store === "user-game-stats" && key === "alex") {
        return Promise.resolve({ playCounts: { "121": 5, "501": 2 } });
      }
      return Promise.resolve(null);
    });
    const games = await getQuickStartGames("alex", 2);
    expect(games.map((g) => g.slug)).toEqual(["121", "501"]);
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
});
