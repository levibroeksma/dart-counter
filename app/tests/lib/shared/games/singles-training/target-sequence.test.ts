import { describe, it, expect } from "vitest";
import {
  buildTargetSequence,
  ALL_TARGETS,
} from "@lib/shared/games/singles-training/target-sequence";

describe("buildTargetSequence", () => {
  it("low-to-high returns 1..20 then bull", () => {
    const seq = buildTargetSequence("low-to-high");
    expect(seq).toEqual([...Array.from({ length: 20 }, (_, i) => i + 1), "bull"]);
  });

  it("high-to-low returns bull then 20..1", () => {
    const seq = buildTargetSequence("high-to-low");
    expect(seq[0]).toBe("bull");
    expect(seq[1]).toBe(20);
    expect(seq[20]).toBe(1);
  });

  it("random returns all 21 targets", () => {
    const seq = buildTargetSequence("random", () => 0.5);
    expect(seq).toHaveLength(21);
    expect(new Set(seq)).toEqual(new Set(ALL_TARGETS));
  });
});
