import { describe, it, expect } from "vitest";
import {
  deriveSuccessAttempts, deriveFailureAttempts,
  buildRoundRecord, validateRoundRecord,
} from "@lib/shared/games/ten-up-one-down/round";

describe("deriveSuccessAttempts", () => {
  it("1 dart on double", () => {
    expect(deriveSuccessAttempts(1, "D16")).toEqual([{ double: "D16", hit: true }]);
  });
  it("2 darts on double", () => {
    expect(deriveSuccessAttempts(2, "D16")).toEqual([
      { double: "D16", hit: false }, { double: "D16", hit: true },
    ]);
  });
  it("3 darts on double", () => {
    expect(deriveSuccessAttempts(3, "D16")).toHaveLength(3);
    expect(deriveSuccessAttempts(3, "D16").filter((a) => a.hit)).toHaveLength(1);
  });
});

describe("deriveFailureAttempts", () => {
  it("returns empty when onDouble is 0", () => {
    expect(deriveFailureAttempts(0, null)).toEqual([]);
  });
  it("returns misses for onDouble > 0", () => {
    expect(deriveFailureAttempts(2, "D20")).toEqual([
      { double: "D20", hit: false }, { double: "D20", hit: false },
    ]);
  });
});

describe("buildRoundRecord", () => {
  it("builds success record", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "success", dartsUsed: 2, onDouble: 2, finishedOnDouble: "D16",
    });
    expect(record.finished).toBe(true);
    expect(record.dartsUsed).toBe(2);
    expect(record.doubleAttempts).toHaveLength(2);
  });

  it("builds failure record with busted", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "failure", dartsUsed: 3, onDouble: 0, doubleAttempted: null, busted: true,
    });
    expect(record.finished).toBe(false);
    expect(record.busted).toBe(true);
    expect(record.doubleAttempts).toEqual([]);
  });
});

describe("validateRoundRecord", () => {
  it("rejects success with multiple hits", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "success", dartsUsed: 2, onDouble: 2, finishedOnDouble: "D16",
    });
    record.doubleAttempts.push({ double: "D20", hit: true });
    expect(validateRoundRecord(record).valid).toBe(false);
  });
});
