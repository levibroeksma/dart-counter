export const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159] as const;

export function isBogey(target: number): boolean {
  return (BOGEY_NUMBERS as readonly number[]).includes(target);
}

/**
 * Snap to nearest non-bogey in the adjustment direction; preferHigher follows last +/- move.
 */
export function nearestNonBogey(target: number, preferHigher: boolean): number {
  if (!isBogey(target)) return target;
  if (preferHigher) {
    let higher = target + 1;
    while (higher <= 170 && isBogey(higher)) higher++;
    return higher;
  }
  let lower = target - 1;
  while (lower >= 2 && isBogey(lower)) lower--;
  return lower;
}
