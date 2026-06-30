import type { Rng } from "./rng";

export function sampleWeightedBucket<T extends string>(
  weights: Record<T, number>,
  rng: Rng,
): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

function redistributeHitWeight(
  source: Record<string, number>,
  hitKey: string,
  shiftPoints: number,
): Record<string, number> {
  const total = Object.values(source).reduce((a, b) => a + b, 0);
  const hitWeight = source[hitKey] ?? 0;
  const others = Object.keys(source).filter((k) => k !== hitKey);
  const otherTotal = others.reduce((s, k) => s + source[k], 0);

  let appliedShift = shiftPoints;
  if (shiftPoints > 0) {
    appliedShift = Math.min(shiftPoints, total - hitWeight);
  } else if (shiftPoints < 0) {
    appliedShift = -Math.min(Math.abs(shiftPoints), hitWeight);
  }
  if (appliedShift === 0 || otherTotal === 0) return { ...source };

  const next: Record<string, number> = { ...source };
  next[hitKey] = hitWeight + appliedShift;
  for (const key of others) {
    const share = (source[key] / otherTotal) * Math.abs(appliedShift);
    next[key] =
      shiftPoints > 0 ? source[key] - share : source[key] + share;
  }

  const rounded = Object.fromEntries(
    Object.entries(next).map(([k, v]) => [k, Math.max(0, Math.round(v))]),
  );
  const sum = Object.values(rounded).reduce((a, b) => a + b, 0);
  rounded[hitKey] = rounded[hitKey] + (total - sum);
  return rounded;
}

export function applyHitShift<T extends Record<string, number>>(
  weights: T,
  hitKey: keyof T & string,
  shiftPoints: number,
): T {
  if (shiftPoints === 0) return { ...weights };
  return redistributeHitWeight(weights as Record<string, number>, hitKey, shiftPoints) as T;
}
