import { describe, it, expect } from "vitest";
import { buildRoundRecord, validateRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

describe("buildRoundRecord", () => {
  it("builds success record with derived dartsUsed", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "success",
      dartsForFinish: 2,
      dartsOnDouble: 1,
    });
    expect(record).toEqual({
      roundNumber: 1,
      targetAtStart: 41,
      targetAfter: 41,
      finished: true,
      dartsUsed: 2,
      dartsOnDouble: 1,
    });
  });

  it("builds failure record", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 2,
    });
    expect(record).toEqual({
      roundNumber: 1,
      targetAtStart: 41,
      targetAfter: 41,
      finished: false,
      dartsUsed: 3,
      dartsOnDouble: 2,
    });
  });
});

describe("validateRoundRecord", () => {
  it("rejects success when dartsOnDouble > dartsUsed", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "success",
      dartsForFinish: 2,
      dartsOnDouble: 3,
    });
    expect(validateRoundRecord(record).valid).toBe(false);
  });

  it("rejects failure when dartsOnDouble > dartsUsed", () => {
    const record = buildRoundRecord(1, 41, {
      outcome: "failure",
      dartsUsed: 2,
      dartsOnDouble: 3,
    });
    expect(validateRoundRecord(record).valid).toBe(false);
  });

  it("accepts valid success and failure records", () => {
    expect(
      validateRoundRecord(
        buildRoundRecord(1, 40, { outcome: "success", dartsForFinish: 1, dartsOnDouble: 1 }),
      ).valid,
    ).toBe(true);
    expect(
      validateRoundRecord(
        buildRoundRecord(1, 40, { outcome: "failure", dartsUsed: 3, dartsOnDouble: 0 }),
      ).valid,
    ).toBe(true);
  });
});
