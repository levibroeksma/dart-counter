import type { BotCheckoutRoute } from "./bot-checkout-route";
import type { SkillProfile } from "../types";

export interface CheckoutPolicy {
  select(routes: BotCheckoutRoute[], skill: SkillProfile): BotCheckoutRoute;
}

export class SkillCheckoutPolicy implements CheckoutPolicy {
  select(routes: BotCheckoutRoute[], skill: SkillProfile): BotCheckoutRoute {
    if (routes.length === 0) throw new Error("No checkout routes");
    const sorted = [...routes].sort((a, b) => b.quality - a.quality);
    const spread = Math.floor(
      (1 - skill.execution.checkoutDiscipline) * sorted.length,
    );
    return sorted[Math.min(spread, sorted.length - 1)]!;
  }
}
