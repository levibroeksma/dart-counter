import { getSkillProfile } from "./levels";

const OPEN_ENDED_MAX = 999;

export type DartbotLevelPreview = {
  threeDartAverage: string;
  checkoutSuccessRate: string;
};

function formatAverageRange(min: number, max: number): string {
  const lo = Math.round(min);
  if (max >= OPEN_ENDED_MAX) return `${lo}+`;
  const hi = Math.round(max);
  if (lo === hi) return `${lo}`;
  return `${lo}–${hi}`;
}

/**
 * User-facing stat labels for a DartBot difficulty level.
 */
export function formatDartbotLevelPreview(level: number): DartbotLevelPreview {
  const profile = getSkillProfile(level);
  return {
    threeDartAverage: formatAverageRange(
      profile.threeDartAverage.min,
      profile.threeDartAverage.max,
    ),
    checkoutSuccessRate: `${profile.checkoutPercentage.min}–${profile.checkoutPercentage.max}%`,
  };
}
