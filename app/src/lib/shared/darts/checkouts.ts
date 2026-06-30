import { isBogey } from "./bogeys";
import { CHECKOUT_HINTS } from "./checkout-hints.data";

export type CheckoutRoute = { segments: string[] };

export function getCheckoutHint(target: number): CheckoutRoute | null {
  if (isBogey(target)) return null;
  const segments = CHECKOUT_HINTS[target];
  if (!segments) return null;
  return { segments };
}
