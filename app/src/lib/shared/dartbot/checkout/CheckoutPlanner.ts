import type { CheckoutKnowledge } from "./CheckoutKnowledge";
import type { CheckoutPolicy } from "./CheckoutPolicy";
import type { BotCheckoutRoute } from "./bot-checkout-route";
import type { SkillProfile } from "../types";

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
