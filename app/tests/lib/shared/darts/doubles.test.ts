import { describe, it, expect } from "vitest";
import { ALL_DOUBLES } from "@lib/shared/darts/doubles";

describe("ALL_DOUBLES", () => {
  it("contains D1–D20 and Bull", () => {
    expect(ALL_DOUBLES).toHaveLength(21);
    expect(ALL_DOUBLES[0]).toBe("D1");
    expect(ALL_DOUBLES[19]).toBe("D20");
    expect(ALL_DOUBLES[20]).toBe("Bull");
  });
});
