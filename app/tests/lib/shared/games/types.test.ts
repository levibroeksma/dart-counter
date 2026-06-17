import { describe, it, expect } from "vitest";
import { SEED_GAMES } from "@lib/shared/games/types";

describe("SEED_GAMES", () => {
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

  it("marks placeholder games as unreleased", () => {
    const placeholders = SEED_GAMES.filter((g) =>
      ["501", "121"].includes(g.slug)
    );
    expect(placeholders).toHaveLength(2);
    expect(placeholders.every((g) => g.released === false)).toBe(true);
  });

  it("marks ten-up-one-down as released", () => {
    const game = SEED_GAMES.find((g) => g.slug === "ten-up-one-down");
    expect(game?.released).toBe(true);
  });
});
