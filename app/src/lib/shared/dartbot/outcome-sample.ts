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
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const maxShift = Math.min(shiftPoints, total - (weights[hitKey] as number));
  if (maxShift <= 0) return { ...weights };
  const others = Object.keys(weights).filter((k) => k !== hitKey);
  const otherTotal = others.reduce((s, k) => s + (weights[k] as number), 0);
  const next = { ...weights } as T;
  next[hitKey] = ((next[hitKey] as number) + maxShift) as T[keyof T];
  for (const key of others) {
    const share = ((weights[key] as number) / otherTotal) * maxShift;
    next[key as keyof T] = ((weights[key] as number) - share) as T[keyof T];
  }
  const rounded = Object.fromEntries(
    Object.entries(next).map(([k, v]) => [k, Math.max(0, Math.round(v as number))]),
  ) as T;
  const sum = Object.values(rounded).reduce((a, b) => a + b, 0);
  rounded[hitKey] = ((rounded[hitKey] as number) + (total - sum)) as T[keyof T];
  return rounded;
}
