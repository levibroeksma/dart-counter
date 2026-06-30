import type { ModalQuestion } from "./checkout-constraints";
import { getCheckoutConstraints } from "./checkout-constraints";

export function isSingleDartFinishable(remaining: number): boolean {
  const constraints = getCheckoutConstraints(remaining);
  return constraints?.minFinish === 1;
}

export function maxDartsOnDoubleForPartialVisit(
  visitScore: number,
  remainingAfter?: number,
): number {
  if (visitScore === 0) return 3;
  let max = Math.min(3, Math.ceil(visitScore / 13));
  if (
    remainingAfter !== undefined &&
    isSingleDartFinishable(remainingAfter)
  ) {
    max = Math.min(max, 2);
  }
  return max;
}

export function buildPartialDoubleModalQuestion(
  visitScore: number,
  remainingAfter?: number,
): ModalQuestion {
  const max = maxDartsOnDoubleForPartialVisit(visitScore, remainingAfter);
  return {
    id: "dartsOnDouble",
    label: "Darts on double",
    options: Array.from({ length: max + 1 }, (_, i) => i),
  };
}
