import { describe, expect, it } from "vitest";
import {
  computeSetRunningStats,
  createEmptySetRunningStats,
  createRng,
  generateMatchPlan,
  getSkillProfile,
  isWithinStatBand,
  simulateVisit,
  type BotVisitForStats,
} from "@lib/shared/dartbot";

const SET_COUNT = 6;
const LEGS_PER_SET = 9;
const MAX_VISITS_PER_LEG = 200;
const SEEDS = [40_001, 40_002, 40_003, 40_004];

function toVisitStats(input: {
  remainingBefore: number;
  dartsThrown: number;
  visitScore: number;
  checkout: boolean;
  doubleAttempts: number;
}): BotVisitForStats {
  return {
    dartsThrown: input.dartsThrown,
    visitScore: input.visitScore,
    isScoringVisit: input.remainingBefore > 170,
    doubleAttempts: input.doubleAttempts,
    checkouts: input.checkout ? 1 : 0,
  };
}

describe("dartbot Monte Carlo level validation", { timeout: 30_000 }, () => {
  it("keeps level 1-10 leg/set stats inside configured bands", () => {
    for (let level = 1; level <= 10; level += 1) {
      const skill = getSkillProfile(level);

      let legCount = 0;
      let legThreeDartHits = 0;
      let legScoringHits = 0;
      let setThreeDartHits = 0;
      let setScoringHits = 0;
      let setCheckoutTotal = 0;
      let setCount = 0;

      for (const seed of SEEDS) {
        const plan = generateMatchPlan(
          skill,
          SET_COUNT * LEGS_PER_SET,
          seed + level * 100,
        );
        const rng = createRng(seed + level * 1_000);

        for (let setIndex = 0; setIndex < SET_COUNT; setIndex += 1) {
          const setVisits: BotVisitForStats[] = [];
          let setRunningStats = createEmptySetRunningStats();

          for (let legIndex = 0; legIndex < LEGS_PER_SET; legIndex += 1) {
            const legVisits: BotVisitForStats[] = [];
            const legTarget = plan.legTargets[setIndex * LEGS_PER_SET + legIndex]!;
            let remaining = 501;
            let visitCounter = 0;

            while (remaining > 0 && visitCounter < MAX_VISITS_PER_LEG) {
              const remainingBefore = remaining;
              const visit = simulateVisit(
                {
                  remaining,
                  skill,
                  legTarget,
                  dartsInVisit: 3,
                  setRunningStats,
                },
                rng,
              );

              const doubleAttempts = visit.darts.filter(
                (dart) => dart.actual.ring === "double" || dart.actual.ring === "bull",
              ).length;

              const statVisit = toVisitStats({
                remainingBefore,
                dartsThrown: visit.darts.length,
                visitScore: visit.visitScore,
                checkout: visit.checkout,
                doubleAttempts,
              });

              legVisits.push(statVisit);
              setVisits.push(statVisit);
              setRunningStats = computeSetRunningStats(setVisits);

              if (visit.checkout) {
                remaining = 0;
              } else if (!visit.bust) {
                remaining -= visit.visitScore;
              }

              visitCounter += 1;
            }

            expect(remaining, `level ${level} leg ${legIndex + 1} should finish`).toBe(0);

            const legStats = computeSetRunningStats(legVisits);
            legCount += 1;
            if (
              isWithinStatBand(legStats.threeDartAverage, skill.threeDartAverage, "leg")
            ) {
              legThreeDartHits += 1;
            }
            if (isWithinStatBand(legStats.scoringAverage, skill.scoringAverage, "leg")) {
              legScoringHits += 1;
            }
          }

          const setStats = computeSetRunningStats(setVisits);
          if (isWithinStatBand(setStats.threeDartAverage, skill.threeDartAverage, "set")) {
            setThreeDartHits += 1;
          }
          if (isWithinStatBand(setStats.scoringAverage, skill.scoringAverage, "set")) {
            setScoringHits += 1;
          }
          setCheckoutTotal += setStats.checkoutPercentage;
          setCount += 1;
        }
      }

      const setCheckoutMean = setCheckoutTotal / setCount;

      expect(legThreeDartHits / legCount, `level ${level} leg 3DA hit ratio`).toBeGreaterThanOrEqual(0.44);
      expect(legScoringHits / legCount, `level ${level} leg scoring hit ratio`).toBeGreaterThanOrEqual(0.44);
      expect(setThreeDartHits / setCount, `level ${level} set 3DA hit ratio`).toBeGreaterThanOrEqual(0.1);
      expect(setScoringHits / setCount, `level ${level} set scoring hit ratio`).toBeGreaterThanOrEqual(0.1);
      expect(setCheckoutMean, `level ${level} set mean checkout %`).toBeGreaterThanOrEqual(
        skill.checkoutPercentage.min,
      );
      expect(setCheckoutMean, `level ${level} set mean checkout %`).toBeLessThanOrEqual(
        skill.checkoutPercentage.max,
      );
    }
  });
});
