import {
  buildPartialDoubleModalQuestion,
  buildSuccessModalQuestions,
  isFinishableCheckout,
  isSingleDartFinishable,
} from "@lib/shared/darts";
import type { ModalQuestion } from "@lib/shared/darts";
import type { VisitClassification } from "./types";

export type CheckoutModalKind = "finish" | "partial";

export type Resolved501CheckoutModal = {
  kind: CheckoutModalKind;
  questions: ModalQuestion[];
};

export function resolve501CheckoutModal(
  remainingBefore: number,
  visitScore: number,
  outcome: VisitClassification,
): Resolved501CheckoutModal | null {
  if (outcome.checkout) {
    return {
      kind: "finish",
      questions: buildSuccessModalQuestions(remainingBefore),
    };
  }

  if (!isFinishableCheckout(remainingBefore)) return null;

  const remainingAfter = outcome.bust
    ? remainingBefore
    : outcome.remainingAfter;

  const partialRemaining =
    isSingleDartFinishable(remainingAfter) ||
    (isFinishableCheckout(remainingAfter) && remainingAfter <= 50);

  if (!partialRemaining) return null;

  return {
    kind: "partial",
    questions: [buildPartialDoubleModalQuestion(visitScore)],
  };
}
