import { CHECKOUT_HINTS } from "@lib/shared/darts/checkout-hints.data";
import { parseSegment } from "../segments";
import type { BotCheckoutRoute } from "./bot-checkout-route";

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
