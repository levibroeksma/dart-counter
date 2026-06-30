import { buildLevelProfile } from "./interpolate-levels";
import type { SkillProfile } from "./types";

export { ANCHOR_PROFILES, LEVEL_STAT_RANGES } from "./level-profiles";

export function getSkillProfile(level: number): SkillProfile {
  return buildLevelProfile(level);
}
