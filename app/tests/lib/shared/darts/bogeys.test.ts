import { describe, it, expect } from "vitest";
import { BOGEY_NUMBERS, isBogey, nearestNonBogey } from "@lib/shared/darts";

describe("bogeys", () => {
  it("identifies bogey numbers", () => {
    expect(isBogey(169)).toBe(true);
    expect(isBogey(41)).toBe(false);
  });
  it("snaps to nearest non-bogey preferring higher on success", () => {
    expect(nearestNonBogey(169, true)).toBe(170);
    expect(nearestNonBogey(168, true)).toBe(170);
  });
  it("snaps to nearest non-bogey preferring lower on failure", () => {
    expect(nearestNonBogey(169, false)).toBe(167);
    expect(nearestNonBogey(168, false)).toBe(167);
  });
  it("returns target unchanged when not bogey", () => {
    expect(nearestNonBogey(50, true)).toBe(50);
  });
  it("exports all bogey numbers", () => {
    expect(BOGEY_NUMBERS).toEqual([169, 168, 166, 165, 163, 162, 159]);
  });
});
