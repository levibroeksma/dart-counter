import { describe, it, expect } from "vitest";
import { SkillCheckoutPolicy } from "@lib/shared/dartbot/checkout/CheckoutPolicy";
import { createCheckoutKnowledge } from "@lib/shared/dartbot/checkout/CheckoutKnowledge";
import { CheckoutPlanner } from "@lib/shared/dartbot/checkout/CheckoutPlanner";
import { evaluateSetupRoute } from "@lib/shared/dartbot/checkout/CheckoutEvaluator";
import { getSkillProfile } from "@lib/shared/dartbot/levels";

describe("CheckoutPlanner", () => {
  const planner = new CheckoutPlanner(
    createCheckoutKnowledge(),
    new SkillCheckoutPolicy(),
  );

  it("selects best route at level 10", () => {
    const route = planner.route(81, getSkillProfile(10));
    expect(route.darts[0]!.label).toBe("T19");
    expect(route.quality).toBe(95);
  });

  it("may select suboptimal route at level 1", () => {
    const routes = Array.from({ length: 20 }, () =>
      planner.route(81, getSkillProfile(1)),
    );
    const qualities = new Set(routes.map((r) => r.quality));
    expect(qualities.size).toBeGreaterThanOrEqual(1);
  });
});

describe("evaluateSetupRoute", () => {
  const knowledge = createCheckoutKnowledge();

  it("boosts routes with good preferred leave", () => {
    const route = knowledge.routes(81)[0]!;
    expect(evaluateSetupRoute(route)).toBeGreaterThanOrEqual(route.quality);
  });
});
