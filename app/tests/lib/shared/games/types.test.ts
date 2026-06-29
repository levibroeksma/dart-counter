import { describe, it, expect } from "vitest";
import { SEED_GAMES } from "@lib/shared/games/types";

describe("SEED_GAMES", () => {
  it("includes 501 as released", () => {
    expect(SEED_GAMES).toContainEqual({
      slug: "501",
      displayName: "501",
      sortOrder: 1,
      enabled: true,
      released: true,
    });
  });

  it("includes score-training as released", () => {
    expect(SEED_GAMES).toContainEqual({
      slug: "score-training",
      displayName: "Score Training",
      sortOrder: 4,
      enabled: true,
      released: true,
    });
  });

  it("includes singles-training as released", () => {
    expect(SEED_GAMES).toContainEqual({
      slug: "singles-training",
      displayName: "Singles Training",
      sortOrder: 5,
      enabled: true,
      released: true,
    });
  });

  it("marks 121 as unreleased placeholder", () => {
    const game = SEED_GAMES.find((g) => g.slug === "121");
    expect(game?.released).toBe(false);
  });

  it("marks ten-up-one-down as released", () => {
    const game = SEED_GAMES.find((g) => g.slug === "ten-up-one-down");
    expect(game?.released).toBe(true);
  });
});
