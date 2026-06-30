import { describe, it, expect } from "vitest";
import {
  DARTS_PER_VISIT,
  DEFAULT_DIRECTION,
  DEFAULT_MODE,
  DEFAULT_SCORING,
  TARGET_COUNT,
} from "@lib/shared/games/singles-training";

describe("singles-training constants", () => {
  it("exports expected defaults", () => {
    expect(DARTS_PER_VISIT).toBe(3);
    expect(TARGET_COUNT).toBe(21);
    expect(DEFAULT_DIRECTION).toBe("low-to-high");
    expect(DEFAULT_MODE).toBe("normal");
    expect(DEFAULT_SCORING).toBe("traditional");
  });
});
