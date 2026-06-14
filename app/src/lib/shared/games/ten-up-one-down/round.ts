import type { DoubleTarget } from "@lib/shared/darts/doubles";
import { MessageCode } from "@lib/shared/constants/errors.constants";

export type DoubleAttempt = { double: DoubleTarget; hit: boolean };

export type TenUpOneDownRoundRecord = {
  roundNumber: number;
  targetAtStart: number;
  targetAfter: number;
  finished: boolean;
  dartsUsed: 1 | 2 | 3;
  doubleAttempts: DoubleAttempt[];
  busted?: boolean;
};

export type WizardInput =
  | { outcome: "success"; dartsUsed: 1 | 2 | 3; onDouble: 1 | 2 | 3; finishedOnDouble: DoubleTarget }
  | { outcome: "failure"; dartsUsed: 1 | 2 | 3; onDouble: 0 | 1 | 2 | 3; doubleAttempted: DoubleTarget | null; busted: boolean };

export function deriveSuccessAttempts(onDouble: 1 | 2 | 3, finishedOnDouble: DoubleTarget): DoubleAttempt[] {
  return [
    ...Array(onDouble - 1).fill({ double: finishedOnDouble, hit: false }),
    { double: finishedOnDouble, hit: true },
  ];
}

export function deriveFailureAttempts(onDouble: 0 | 1 | 2 | 3, doubleAttempted: DoubleTarget | null): DoubleAttempt[] {
  if (onDouble === 0 || !doubleAttempted) return [];
  return Array(onDouble).fill({ double: doubleAttempted, hit: false });
}

export function buildRoundRecord(
  roundNumber: number,
  targetAtStart: number,
  input: WizardInput
): TenUpOneDownRoundRecord {
  if (input.outcome === "success") {
    const doubleAttempts = deriveSuccessAttempts(input.onDouble, input.finishedOnDouble);
    return {
      roundNumber, targetAtStart, targetAfter: targetAtStart,
      finished: true, dartsUsed: input.dartsUsed, doubleAttempts,
    };
  }
  const doubleAttempts = deriveFailureAttempts(input.onDouble, input.doubleAttempted);
  return {
    roundNumber, targetAtStart, targetAfter: targetAtStart,
    finished: false, dartsUsed: input.dartsUsed, doubleAttempts,
    busted: input.busted,
  };
}

export type ValidateRoundResult =
  | { valid: true }
  | { valid: false; code: typeof MessageCode.INVALID_ROUND };

export function validateRoundRecord(record: TenUpOneDownRoundRecord): ValidateRoundResult {
  if (record.doubleAttempts.length > record.dartsUsed) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  const hits = record.doubleAttempts.filter((a) => a.hit).length;
  if (record.finished) {
    if (hits !== 1) return { valid: false, code: MessageCode.INVALID_ROUND };
  } else {
    if (hits !== 0) return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  return { valid: true };
}
