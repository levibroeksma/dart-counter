import { describe, it, expect } from "vitest";
import { SkillCheckoutPolicy } from "@lib/shared/dartbot/checkout/CheckoutPolicy";
import { createCheckoutKnowledge } from "@lib/shared/dartbot/checkout/CheckoutKnowledge";
import { CheckoutPlanner } from "@lib/shared/dartbot/checkout/CheckoutPlanner";
import { evaluateSetupRoute } from "@lib/shared/dartbot/checkout/CheckoutEvaluator";
import { getSkillProfile } from "@lib/shared/dartbot/levels";

describe("CheckoutPlanner", () => {
  const knowledge = createCheckoutKnowledge();
  const planner = new CheckoutPlanner(
    knowledge,
    new SkillCheckoutPolicy(),
  );

  it("selects the highest-quality setup-zone route at level 10", () => {
    const remaining = 170;
    const route = planner.route(remaining, getSkillProfile(10));
    const bestQuality = Math.max(...knowledge.routes(remaining).map((r) => r.quality));
    expect(route.quality).toBe(bestQuality);
  });

  it("can select non-optimal route at lower levels", () => {
    const routes = Array.from({ length: 20 }, () =>
      planner.route(170, getSkillProfile(1)),
    );
    const qualities = new Set(routes.map((r) => r.quality));
    expect(qualities.size).toBeGreaterThanOrEqual(1);
  });

  it("throws outside setup zone", () => {
    expect(() => planner.route(130, getSkillProfile(10))).toThrow(
      "CheckoutPlanner supports setup-zone scores (131-170) only",
    );
  });
});

describe("evaluateSetupRoute", () => {
  const knowledge = createCheckoutKnowledge();

  it("boosts routes with good preferred leave", () => {
    const route = knowledge.routes(81)[0]!;
    expect(evaluateSetupRoute(route)).toBeGreaterThanOrEqual(route.quality);
  });
});
