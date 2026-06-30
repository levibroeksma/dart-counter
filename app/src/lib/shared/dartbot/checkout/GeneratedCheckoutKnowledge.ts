import { CHECKOUT_HINTS } from "@lib/shared/darts/checkout-hints.data";
import { parseSegment } from "@lib/shared/dartbot/segments";
import type { BotCheckoutRoute } from "@lib/shared/dartbot/checkout/bot-checkout-route";

export function generatedRoutes(remaining: number): BotCheckoutRoute[] {
  const hints = CHECKOUT_HINTS[remaining];
  if (!hints) return [];
  return [
    {
      finish: remaining,
      darts: hints.map((label) => parseSegment(label)),
      quality: 70,
    },
  ];
}
