import type { DoubleTarget } from "@lib/shared/darts/doubles";

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
