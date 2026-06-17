import { describe, it, expect } from "vitest";
import { buildRoundRecord, validateRoundRecord } from "@lib/shared/games/score-training/round";

describe("buildRoundRecord", () => {
  it("builds record with running total", () => {
    expect(buildRoundRecord(1, 60, 0)).toEqual({
      roundNumber: 1,
      visitScore: 60,
      runningTotal: 60,
    });
    expect(buildRoundRecord(2, 45, 60)).toEqual({
      roundNumber: 2,
      visitScore: 45,
      runningTotal: 105,
    });
  });
});

describe("validateRoundRecord", () => {
  it("validates matching round number and score range", () => {
    const record = buildRoundRecord(1, 60, 0);
    expect(validateRoundRecord(record, 1)).toEqual({ valid: true });
    expect(validateRoundRecord(record, 2).valid).toBe(false);
  });

  it("rejects visit scores outside 0-180", () => {
    const record = buildRoundRecord(1, 181, 0);
    expect(validateRoundRecord(record, 1).valid).toBe(false);
  });
});
