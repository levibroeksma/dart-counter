import { describe, it, expect } from "vitest";
import { boardNeighbors, parseSegment, scoreForSegment } from "@lib/shared/dartbot";

describe("segments", () => {
  it("scores singles, doubles, triples, and bull", () => {
    expect(scoreForSegment(parseSegment("20"))).toBe(20);
    expect(scoreForSegment(parseSegment("D20"))).toBe(40);
    expect(scoreForSegment(parseSegment("T20"))).toBe(60);
    expect(scoreForSegment(parseSegment("25"))).toBe(25);
    expect(scoreForSegment(parseSegment("50"))).toBe(50);
  });

  it("boardNeighbors(12) returns 9 and 5", () => {
    expect(boardNeighbors(12)).toEqual([9, 5]);
  });

  it("returns adjacent segments for triple targets", () => {
    const adj = parseSegment("T20").adjacent;
    expect(adj.map((s) => s.label)).toContain("20");
    expect(adj.length).toBeGreaterThan(0);
  });
});
