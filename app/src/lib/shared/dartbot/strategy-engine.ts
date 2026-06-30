import { isFinishableCheckout } from "@lib/shared/darts";
import type { SkillProfile } from "./types";

export type ThrowIntent = "score" | "setup" | "checkout";

export function chooseIntent(input: {
  remaining: number;
  dartsLeft: number;
  skill: SkillProfile;
  legTarget: number;
}): ThrowIntent {
  const { remaining, skill } = input;
  const finishable = isFinishableCheckout(remaining);
  const inSetupZone = remaining >= 131 && remaining <= 170;

  if (finishable && inSetupZone) {
    return skill.level >= 10 ? "checkout" : "setup";
  }
  if (finishable) return "checkout";
  if (inSetupZone) return "setup";
  return "score";
}
