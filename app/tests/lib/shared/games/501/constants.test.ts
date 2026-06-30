import { describe, it, expect } from "vitest";
import {
  LEGS_PER_SET,
  MAX_TARGET_COUNT_LEGS,
  MIN_TARGET_COUNT_LEGS,
  STARTING_SCORE,
} from "@lib/shared/games/501";

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
