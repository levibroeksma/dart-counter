import { describe, expect, it } from "vitest";
import {
  buildPartialDoubleModalQuestion,
  isSingleDartFinishable,
  maxDartsOnDoubleForPartialVisit,
} from "@lib/shared/darts";

describe("checkout-partial", () => {
  it("isSingleDartFinishable is true for 40 and 50, false for 51", () => {
    expect(isSingleDartFinishable(40)).toBe(true);
    expect(isSingleDartFinishable(50)).toBe(true);
    expect(isSingleDartFinishable(51)).toBe(false);
  });

  it("maxDartsOnDoubleForPartialVisit matches 60→47 and 54→40 examples", () => {
    expect(maxDartsOnDoubleForPartialVisit(13)).toBe(1);
    expect(maxDartsOnDoubleForPartialVisit(14)).toBe(2);
    expect(maxDartsOnDoubleForPartialVisit(0)).toBe(3);
  });

  it("buildPartialDoubleModalQuestion returns 0..max options", () => {
    expect(buildPartialDoubleModalQuestion(13)).toEqual({
      id: "dartsOnDouble",
      label: "Darts on double",
      options: [0, 1],
    });
    expect(buildPartialDoubleModalQuestion(14).options).toEqual([0, 1, 2]);
  });
});
