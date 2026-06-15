export type RoundOutcome = "success" | "failure";

export function resolveRoundOutcome(score: string | null, currentTarget: number): RoundOutcome | null {
  if (score === null || score === "") return "failure";
  if (!/^\d+$/.test(score)) return null;
  const value = Number(score);
  if (value > 180) return null;
  return value === currentTarget ? "success" : "failure";
}
