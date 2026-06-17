import { describe, it, expect } from "vitest";
import { getGameCode, formatGameCode } from "@lib/shared/games/codes";

describe("game codes", () => {
  it("returns tuod for ten-up-one-down", () => {
    expect(getGameCode("ten-up-one-down")).toBe("tuod");
  });

  it("returns undefined for slugs without a code", () => {
    expect(getGameCode("score-training")).toBeUndefined();
  });

  it("returns st for singles-training", () => {
    expect(getGameCode("singles-training")).toBe("st");
  });

  it("formats code for display", () => {
    expect(formatGameCode("tuod")).toBe("TUOD");
  });
});
