import type { SinglesTrainingDirection, SinglesTrainingTarget } from "./types";

export const ALL_TARGETS: SinglesTrainingTarget[] = [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  "bull",
];

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildTargetSequence(
  direction: SinglesTrainingDirection,
  random: () => number = Math.random,
): SinglesTrainingTarget[] {
  if (direction === "low-to-high") return [...ALL_TARGETS];
  if (direction === "high-to-low") return ["bull", ...Array.from({ length: 20 }, (_, i) => 20 - i)];
  return shuffle(ALL_TARGETS, random);
}
