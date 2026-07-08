const EMPTY = "—";

export function formatThreeDartAverage(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toFixed(2);
}

export function formatScoringAverage(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toFixed(1);
}

export function formatCheckoutPercentage(value: number | null): string {
  if (value === null) return EMPTY;
  return `${value.toFixed(1)}%`;
}
