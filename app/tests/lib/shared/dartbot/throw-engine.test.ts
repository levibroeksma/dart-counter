import { describe, it, expect } from "vitest";
import { createRng, getSkillProfile, parseSegment } from "@lib/shared/dartbot";
import { throwDart } from "@lib/shared/dartbot/throw-engine";

describe("throwDart", () => {
  it("hits target when rng below hitAccuracy", () => {
    const skill = getSkillProfile(15);
    const rng = createRng(1);
    const originalNext = rng.next.bind(rng);
    let call = 0;
    rng.next = () => {
      call += 1;
      if (call === 1) return 0.01;
      return originalNext();
    };
    const result = throwDart(parseSegment("T20"), skill, rng);
    expect(result.label).toBe("T20");
  });

  it("resolves miss to adjacent segment", () => {
    const skill = getSkillProfile(1);
    const rng = createRng(2);
    const originalNext = rng.next.bind(rng);
    let call = 0;
    rng.next = () => {
      call += 1;
      if (call === 1) return 0.99;
      if (call === 2) return 0;
      return originalNext();
    };
    const target = parseSegment("T20");
    const result = throwDart(target, skill, rng);
    expect(result.label).not.toBe("T20");
    expect(target.adjacent.map((s) => s.label)).toContain(result.label);
  });
});
