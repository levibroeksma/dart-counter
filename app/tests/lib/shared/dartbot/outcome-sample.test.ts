import { describe, expect, it } from "vitest";
import { applyHitShift, sampleWeightedBucket } from "../../../../src/lib/shared/dartbot/outcome-sample";
import { createRng } from "@lib/shared/dartbot";

describe("outcome-sample", () => {
  it("sampleWeightedBucket respects weights", () => {
    const rng = createRng(1);
    const bucket = sampleWeightedBucket({ hit: 100, miss: 0 }, rng);
    expect(bucket).toBe("hit");
  });

  it("applyHitShift increases hit weight and renormalizes", () => {
    const shifted = applyHitShift({ hit: 20, miss: 80 }, "hit", 5);
    expect(shifted.hit).toBe(25);
    expect(shifted.hit + shifted.miss).toBe(100);
  });

  it("applyHitShift decreases hit weight when shift is negative", () => {
    const shifted = applyHitShift({ hit: 20, miss: 80 }, "hit", -5);
    expect(shifted.hit).toBe(15);
    expect(shifted.hit + shifted.miss).toBe(100);
  });
});
