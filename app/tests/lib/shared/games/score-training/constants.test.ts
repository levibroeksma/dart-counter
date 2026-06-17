import { describe, it, expect } from "vitest";
import {
  DEFAULT_ROUND_COUNT,
  DEFAULT_PLAYTIME_SECONDS,
  MIN_PLAYTIME_SECONDS,
  MAX_PLAYTIME_SECONDS,
  DARTS_PER_VISIT,
  STARTING_SCORE,
  MIN_VISIT_SCORE,
  MAX_VISIT_SCORE,
} from "@lib/shared/games/score-training/constants";

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
