import { LEGS_PER_SET } from "@lib/shared/games/501/constants";
import type { FiveOhOneSettings } from "@lib/shared/games/501/settings";
import type { FiveOhOnePlayerState } from "@lib/shared/games/501/session";

type MatchFormat = Pick<
  FiveOhOneSettings,
  "matchMode" | "targetCount" | "unit"
>;

/** Legs or sets required to win the match. */
export function unitsToWinMatch(format: MatchFormat): number {
  if (format.matchMode === "best-of") {
    return Math.ceil(format.targetCount / 2);
  }
  return format.targetCount;
}

export function hasPlayerWonSet(player: FiveOhOnePlayerState): boolean {
  return player.legsWonInSet >= LEGS_PER_SET;
}

export function hasPlayerWonMatch(
  settings: FiveOhOneSettings,
  player: FiveOhOnePlayerState,
): boolean {
  const required = unitsToWinMatch(settings);
  if (settings.unit === "sets") {
    return player.setsWon >= required;
  }
  return player.totalLegsWon >= required;
}
