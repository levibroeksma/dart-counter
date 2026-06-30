import type { SegmentCounts, SinglesTrainingSession } from "./types";

export type {
  SegmentCounts,
  SinglesTrainingGameState,
  SinglesTrainingGameStatus,
  SinglesTrainingSession,
  SinglesTrainingTarget,
} from "./types";

export function createEmptySegmentCounts(): SegmentCounts {
  return { miss: 0, single: 0, double: 0, triple: 0 };
}

export function isSinglesTrainingSession(value: unknown): value is SinglesTrainingSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const state = record.state;
  return (
    record.slug === "singles-training" &&
    state !== null &&
    typeof state === "object" &&
    Array.isArray(record.targetSequence) &&
    Array.isArray(record.dartHistory) &&
    record.settings !== null &&
    typeof record.settings === "object"
  );
}
