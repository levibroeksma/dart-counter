import type { DoubleTarget } from "@lib/shared/darts/doubles";

export type PlayerDoubleStats = Record<DoubleTarget, { attempts: number; successes: number }>;

export type PlayerDartStats = {
  doubleStats: PlayerDoubleStats;
  totalCheckouts: number;
  totalCheckoutDarts: number;
};
