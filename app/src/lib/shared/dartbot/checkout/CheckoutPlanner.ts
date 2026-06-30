import type { CheckoutKnowledge } from "@lib/shared/dartbot/checkout/CheckoutKnowledge";
import type { CheckoutPolicy } from "@lib/shared/dartbot/checkout/CheckoutPolicy";
import type { BotCheckoutRoute } from "@lib/shared/dartbot/checkout/bot-checkout-route";
import type { SkillProfile } from "@lib/shared/dartbot/types";

export class CheckoutPlanner {
  constructor(
    private knowledge: CheckoutKnowledge,
    private policy: CheckoutPolicy,
  ) {}

  route(remaining: number, skill: SkillProfile): BotCheckoutRoute {
    const routes = this.knowledge.routes(remaining);
    if (routes.length === 0) throw new Error(`No route for ${remaining}`);
    return this.policy.select(routes, skill);
  }
}
