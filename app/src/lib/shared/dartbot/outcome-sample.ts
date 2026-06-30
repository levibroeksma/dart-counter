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

export function applyHitShift<T extends Record<string, number>>(
  weights: T,
  hitKey: keyof T & string,
  shiftPoints: number,
): T {
  const source = weights as Record<string, number>;
  const total = Object.values(source).reduce((a, b) => a + b, 0);
  const maxShift = Math.min(shiftPoints, total - (weights[hitKey] as number));
  if (maxShift <= 0) return { ...weights };
  const others = Object.keys(source).filter((k) => k !== hitKey);
  const otherTotal = others.reduce((s, k) => s + source[k], 0);
  const next: Record<string, number> = { ...source };
  next[hitKey] = next[hitKey] + maxShift;
  for (const key of others) {
    const share = (source[key] / otherTotal) * maxShift;
    next[key] = source[key] - share;
  }
  const rounded = Object.fromEntries(
    Object.entries(next).map(([k, v]) => [k, Math.max(0, Math.round(v as number))]),
  ) as Record<string, number>;
  const sum = Object.values(rounded).reduce((a, b) => a + b, 0);
  rounded[hitKey] = rounded[hitKey] + (total - sum);
  return rounded as T;
}
