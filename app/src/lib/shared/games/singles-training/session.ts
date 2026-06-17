import type { SinglesTrainingSettings } from "@lib/shared/games/singles-training/settings";
import type { DartRecord } from "@lib/shared/games/singles-training/dart";

export type SinglesTrainingTarget = number | "bull";
export type SinglesTrainingGameStatus = "active" | "dead" | "completed";

export type SegmentCounts = {
  miss: number;
  single: number;
  double: number;
  triple: number;
};

export type SinglesTrainingGameState = {
  status: SinglesTrainingGameStatus;
  currentTargetIndex: number;
  currentDartInVisit: 0 | 1 | 2;
  score: number;
  segmentCounts: SegmentCounts;
};

export type SinglesTrainingSession = {
  slug: "singles-training";
  settings: SinglesTrainingSettings;
  targetSequence: SinglesTrainingTarget[];
  state: SinglesTrainingGameState;
  dartHistory: DartRecord[];
  createdAt: string;
  updatedAt: string;
};

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
