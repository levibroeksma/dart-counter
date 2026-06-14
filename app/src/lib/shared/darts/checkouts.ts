import { isBogey } from "@lib/shared/darts/bogeys";
import { CHECKOUT_HINTS } from "@lib/shared/darts/checkout-hints.data";

export type CheckoutRoute = { segments: string[] };

export function getCheckoutHint(target: number): CheckoutRoute | null {
  if (isBogey(target)) return null;
  const segments = CHECKOUT_HINTS[target];
  if (!segments) return null;
  return { segments };
}
