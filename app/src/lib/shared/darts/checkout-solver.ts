import { isBogey } from "@lib/shared/darts/bogeys";

export type CheckoutConstraint = { minFinish: number; maxFinish: number };

const SINGLES = Array.from({ length: 20 }, (_, i) => i + 1);
const DOUBLES = Array.from({ length: 20 }, (_, i) => (i + 1) * 2);
const TRIPLES = Array.from({ length: 20 }, (_, i) => (i + 1) * 3);

function scoresForDart(isFinishingDart: boolean): number[] {
  if (isFinishingDart) return [...DOUBLES, 50];
  return [...SINGLES, ...DOUBLES, ...TRIPLES, 25, 50];
}

function canCheckout(remaining: number, dartsLeft: number): boolean {
  if (remaining < 0 || remaining === 1) return false;
  if (remaining === 0) return true;
  if (dartsLeft === 0) return false;

  for (const score of scoresForDart(dartsLeft === 1)) {
    if (canCheckout(remaining - score, dartsLeft - 1)) return true;
  }
  return false;
}

function minDartsToCheckout(remaining: number): number | null {
  for (let darts = 1; darts <= 3; darts++) {
    if (canCheckout(remaining, darts)) return darts;
  }
  return null;
}

function maxDartsToCheckout(remaining: number): number | null {
  for (let darts = 3; darts >= 1; darts--) {
    if (canCheckout(remaining, darts)) return darts;
  }
  return null;
}

/**
 * Compute shortest and longest checkout visit lengths (1–3 darts) for a finishable score.
 */
export function solveCheckoutConstraints(target: number): CheckoutConstraint | null {
  if (target < 2 || target > 170 || target % 2 === 1 && target < 40) return null;
  if (isBogey(target)) return null;

  const minFinish = minDartsToCheckout(target);
  const maxFinish = maxDartsToCheckout(target);
  if (minFinish === null || maxFinish === null) return null;

  return { minFinish, maxFinish };
}

/** Returns true when `score` can be finished in up to 3 darts double-out. */
export function isFinishableCheckout(score: number): boolean {
  return solveCheckoutConstraints(score) !== null;
}

