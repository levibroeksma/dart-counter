import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "@lib/shared/dartbot/rng";
import { getSkillProfile } from "@lib/shared/dartbot/levels";
import { simulateVisit } from "@lib/shared/dartbot/dart-bot";
import type { SimulatedDart } from "@lib/shared/dartbot/types";

function sequenceRng(values: number[]): Rng {
  let index = 0;
  return {
    next: () => {
      const value = values[Math.min(index, values.length - 1)] ?? 0;
      index += 1;
      return value;
    },
    getState: () => index,
    setState: (state: number) => {
      index = state;
    },
  };
}

describe("simulateVisit", () => {
  it("returns 1-3 darts and visitScore equals dart score sum", () => {
    const result = simulateVisit(
      {
        remaining: 501,
        skill: getSkillProfile(10),
        legTarget: 72,
        dartsInVisit: 3,
      },
      createRng(7),
    );

    expect(result.darts.length).toBeGreaterThanOrEqual(1);
    expect(result.darts.length).toBeLessThanOrEqual(3);
    expect(result.visitScore).toBe(
      result.darts.reduce(
        (sum: number, dart: SimulatedDart) => sum + dart.score,
        0,
      ),
    );
  });

  it("is deterministic with the same rng seed", () => {
    const ctx = {
      remaining: 170,
      skill: getSkillProfile(15),
      legTarget: 72,
      dartsInVisit: 3,
    };
    const first = simulateVisit(ctx, createRng(42));
    const second = simulateVisit(ctx, createRng(42));

    expect(first).toEqual(second);
  });

  it("marks bust on invalid finish", () => {
    const result = simulateVisit(
      {
        remaining: 2,
        skill: getSkillProfile(1),
        legTarget: 40,
        dartsInVisit: 3,
      },
      sequenceRng([0.99, 0]),
    );

    expect(result.bust).toBe(true);
    expect(result.checkout).toBe(false);
  });

  it("produces a scoring visit with fixed seed", () => {
    const result = simulateVisit(
      {
        remaining: 501,
        skill: getSkillProfile(15),
        legTarget: 72,
        dartsInVisit: 3,
      },
      createRng(123),
    );

    expect(result.checkout).toBe(false);
    expect(result.bust).toBe(false);
    expect(result.darts.length).toBe(3);
  });

  it("can checkout with fixed seed", () => {
    const result = simulateVisit(
      {
        remaining: 40,
        skill: getSkillProfile(15),
        legTarget: 72,
        dartsInVisit: 3,
      },
      createRng(1),
    );

    expect(result.checkout).toBe(true);
    expect(result.bust).toBe(false);
    expect(result.darts.length).toBeGreaterThanOrEqual(1);
  });
});
