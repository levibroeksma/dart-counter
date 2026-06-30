import { describe, it, expect } from "vitest";
import {
  STARTING_TARGET, DARTS_PER_ROUND, MIN_TARGET, MAX_TARGET,
  SUCCESS_DELTA, FAILURE_DELTA, DEFAULT_ROUND_COUNT, DEFAULT_PLAYTIME_SECONDS,
} from "@lib/shared/games/ten-up-one-down";

describe("ten-up-one-down constants", () => {
  it("exports game rule constants", () => {
    expect(STARTING_TARGET).toBe(41);
    expect(DARTS_PER_ROUND).toBe(3);
    expect(MIN_TARGET).toBe(2);
    expect(MAX_TARGET).toBe(170);
    expect(SUCCESS_DELTA).toBe(10);
    expect(FAILURE_DELTA).toBe(-1);
    expect(DEFAULT_ROUND_COUNT).toBe(10);
    expect(DEFAULT_PLAYTIME_SECONDS).toBe(600);
  });
});
