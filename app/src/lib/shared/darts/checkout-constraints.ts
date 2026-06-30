import { CHECKOUT_CONSTRAINTS } from "./checkout-constraints.data";
import type { CheckoutConstraint } from "./checkout-solver";

export type ModalQuestion = {
  id: "dartsOnDouble" | "dartsForFinish" | "dartsUsed";
  label: string;
  options: number[];
  autoValue?: number;
};

export function getCheckoutConstraints(target: number): CheckoutConstraint | null {
  return CHECKOUT_CONSTRAINTS[target] ?? null;
}

function dartsForFinishQuestion(c: CheckoutConstraint): ModalQuestion {
  if (c.minFinish === c.maxFinish) {
    return { id: "dartsForFinish", label: "Darts for finish", options: [c.minFinish], autoValue: c.minFinish };
  }
  if (c.minFinish === 2 && c.maxFinish === 3) {
    return { id: "dartsForFinish", label: "Darts for finish", options: [2, 3] };
  }
  return { id: "dartsForFinish", label: "Darts for finish", options: [1, 2, 3] };
}

function dartsOnDoubleQuestion(c: CheckoutConstraint): ModalQuestion {
  if (c.minFinish === 3) {
    return { id: "dartsOnDouble", label: "Darts on double", options: [1], autoValue: 1 };
  }
  if (c.minFinish === 1) {
    return { id: "dartsOnDouble", label: "Darts on double", options: [1, 2, 3] };
  }
  return { id: "dartsOnDouble", label: "Darts on double", options: [1, 2] };
}

export function buildSuccessModalQuestions(target: number): ModalQuestion[] {
  const c = getCheckoutConstraints(target);
  if (!c) return [];
  return [dartsForFinishQuestion(c), dartsOnDoubleQuestion(c)];
}

export function buildFailureModalQuestions(): ModalQuestion[] {
  return [
    { id: "dartsOnDouble", label: "Darts on double", options: [0, 1, 2, 3] },
    { id: "dartsUsed", label: "Darts used", options: [1, 2, 3] },
  ];
}
