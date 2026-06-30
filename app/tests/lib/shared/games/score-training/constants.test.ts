import { describe, it, expect } from "vitest";
import {
  DARTS_PER_VISIT,
  DEFAULT_PLAYTIME_SECONDS,
  DEFAULT_ROUND_COUNT,
  MAX_PLAYTIME_SECONDS,
  MAX_VISIT_SCORE,
  MIN_PLAYTIME_SECONDS,
  MIN_VISIT_SCORE,
  STARTING_SCORE,
} from "@lib/shared/games/score-training";

describe("score-training constants", () => {
  it("exports expected defaults and bounds", () => {
    expect(DEFAULT_ROUND_COUNT).toBe(10);
    expect(DEFAULT_PLAYTIME_SECONDS).toBe(600);
    expect(MIN_PLAYTIME_SECONDS).toBe(300);
    expect(MAX_PLAYTIME_SECONDS).toBe(1800);
    expect(DARTS_PER_VISIT).toBe(3);
    expect(STARTING_SCORE).toBe(0);
    expect(MIN_VISIT_SCORE).toBe(0);
    expect(MAX_VISIT_SCORE).toBe(180);
  });
});
