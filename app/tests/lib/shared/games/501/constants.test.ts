import { describe, it, expect } from "vitest";
import {
  STARTING_SCORE,
  LEGS_PER_SET,
  MIN_TARGET_COUNT_LEGS,
  MAX_TARGET_COUNT_LEGS,
} from "@lib/shared/games/501/constants";

describe("501 constants", () => {
  it("uses standard 501 starting score", () => {
    expect(STARTING_SCORE).toBe(501);
  });

  it("uses first-to-3 legs per set", () => {
    expect(LEGS_PER_SET).toBe(3);
  });

  it("bounds leg target counts", () => {
    expect(MIN_TARGET_COUNT_LEGS).toBe(1);
    expect(MAX_TARGET_COUNT_LEGS).toBe(11);
  });
});
