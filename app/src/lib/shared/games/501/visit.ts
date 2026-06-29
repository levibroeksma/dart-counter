import { isFinishableCheckout } from "@lib/shared/darts/checkout-solver";

export type VisitClassification = {
  bust: boolean;
  checkout: boolean;
  remainingAfter: number;
};

/**
 * Classifies a visit outcome from remaining score and visit total.
 */
export function classifyVisit(
  remainingBefore: number,
  visitScore: number,
): VisitClassification {
  const remainingAfter = remainingBefore - visitScore;

  if (remainingAfter < 0 || remainingAfter === 1) {
    return { bust: true, checkout: false, remainingAfter: remainingBefore };
  }

  if (remainingAfter === 0) {
    const valid = isFinishableCheckout(remainingBefore);
    return {
      bust: !valid,
      checkout: valid,
      remainingAfter: valid ? 0 : remainingBefore,
    };
  }

  return { bust: false, checkout: false, remainingAfter };
}
