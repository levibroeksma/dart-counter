import type { BotCheckoutRoute } from "@lib/shared/dartbot/checkout/bot-checkout-route";

export function evaluateSetupRoute(route: BotCheckoutRoute): number {
  const leave =
    route.preferredLeave ??
    route.finish - route.darts.reduce((s, d) => s + d.score, 0);
  if (leave <= 0) return route.quality;
  return route.quality + (leave <= 40 ? 10 : leave <= 60 ? 5 : 0);
}
