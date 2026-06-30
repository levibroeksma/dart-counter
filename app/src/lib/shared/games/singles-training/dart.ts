import type {
  DartOutcome,
  DartRecord,
  SinglesTrainingScoring,
  SinglesTrainingTarget,
} from "./types";

export type { DartOutcome, DartOutcomeType, DartRecord } from "./types";

export function calculateDartPoints(
  outcome: DartOutcome,
  scoring: SinglesTrainingScoring,
): number {
  if (outcome.type === "miss") return 0;
  if (scoring === "uniform") return 1;
  if (outcome.type === "single") return 1;
  if (outcome.type === "double") return 2;
  return 3;
}

export function isHit(outcome: DartOutcome): boolean {
  return outcome.type !== "miss";
}

export function isValidOutcomeForTarget(
  target: SinglesTrainingTarget,
  outcome: DartOutcome,
): boolean {
  if (target === "bull") {
    return outcome.type === "miss" || outcome.type === "single" || outcome.type === "double";
  }
  return (
    outcome.type === "miss" ||
    outcome.type === "single" ||
    outcome.type === "double" ||
    outcome.type === "triple"
  );
}

export function formatDartOutcomeLabel(
  target: SinglesTrainingTarget,
  outcome: DartOutcome,
): string {
  if (outcome.type === "miss") return "Miss";
  if (target === "bull") {
    return outcome.type === "single" ? "25" : "Bull";
  }
  const prefix = outcome.type === "single" ? "S" : outcome.type === "double" ? "D" : "T";
  return `${prefix}${target}`;
}

export function buildDartRecord(
  targetIndex: number,
  dartInVisit: 0 | 1 | 2,
  outcome: DartOutcome,
  scoring: SinglesTrainingScoring,
): DartRecord {
  return {
    targetIndex,
    dartInVisit,
    outcome,
    points: calculateDartPoints(outcome, scoring),
  };
}
