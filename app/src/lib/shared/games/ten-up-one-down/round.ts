import { MessageCode } from "@lib/shared/constants/errors.constants";

export type TenUpOneDownRoundRecord = {
  roundNumber: number;
  targetAtStart: number;
  targetAfter: number;
  finished: boolean;
  dartsUsed: 1 | 2 | 3;
  dartsOnDouble: 0 | 1 | 2 | 3;
};

export type RoundInput =
  | { outcome: "success"; dartsForFinish: 1 | 2 | 3; dartsOnDouble: 1 | 2 | 3 }
  | { outcome: "failure"; dartsUsed: 1 | 2 | 3; dartsOnDouble: 0 | 1 | 2 | 3 };

export function buildRoundRecord(
  roundNumber: number,
  targetAtStart: number,
  input: RoundInput,
): TenUpOneDownRoundRecord {
  if (input.outcome === "success") {
    return {
      roundNumber,
      targetAtStart,
      targetAfter: targetAtStart,
      finished: true,
      dartsUsed: input.dartsForFinish,
      dartsOnDouble: input.dartsOnDouble,
    };
  }
  return {
    roundNumber,
    targetAtStart,
    targetAfter: targetAtStart,
    finished: false,
    dartsUsed: input.dartsUsed,
    dartsOnDouble: input.dartsOnDouble,
  };
}

export type ValidateRoundResult =
  | { valid: true }
  | { valid: false; code: typeof MessageCode.INVALID_ROUND };

export function validateRoundRecord(record: TenUpOneDownRoundRecord): ValidateRoundResult {
  if (record.finished) {
    if (record.dartsOnDouble < 1 || record.dartsOnDouble > 3) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
    if (record.dartsUsed < 1 || record.dartsUsed > 3) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
    if (record.dartsOnDouble > record.dartsUsed) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }
    return { valid: true };
  }

  if (record.dartsOnDouble < 0 || record.dartsOnDouble > 3) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  if (record.dartsUsed < 1 || record.dartsUsed > 3) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  if (record.dartsOnDouble > record.dartsUsed) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }
  return { valid: true };
}
