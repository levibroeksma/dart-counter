import { LEGS_PER_SET } from "@lib/shared/games/501/constants";
import type { FiveOhOneSettings } from "./types";

export function estimateLegCount(settings: FiveOhOneSettings): number {
  if (settings.unit === "legs") return settings.targetCount;
  return settings.targetCount * LEGS_PER_SET;
}
