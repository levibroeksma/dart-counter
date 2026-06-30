import type { ModalQuestion } from "./checkout-constraints";
import { getCheckoutConstraints } from "./checkout-constraints";

export function isSingleDartFinishable(remaining: number): boolean {
  const constraints = getCheckoutConstraints(remaining);
  return constraints?.minFinish === 1;
}

export function maxDartsOnDoubleForPartialVisit(visitScore: number): number {
  if (visitScore === 0) return 3;
  return Math.min(3, Math.ceil(visitScore / 13));
}

export function buildPartialDoubleModalQuestion(visitScore: number): ModalQuestion {
  const max = maxDartsOnDoubleForPartialVisit(visitScore);
  return {
    id: "dartsOnDouble",
    label: "Darts on double",
    options: Array.from({ length: max + 1 }, (_, i) => i),
  };
}
