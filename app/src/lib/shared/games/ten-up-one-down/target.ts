import { nearestNonBogey } from "@lib/shared/darts";
import { MAX_TARGET, MIN_TARGET, SUCCESS_DELTA, FAILURE_DELTA } from "./constants";

export type TargetResolution = { target: number; completedOn170: boolean };

export function resolveTargetAfterRound(
  currentTarget: number,
  success: boolean
): TargetResolution {
  if (success && currentTarget === MAX_TARGET) {
    return { target: MAX_TARGET, completedOn170: true };
  }

  const raw = success ? currentTarget + SUCCESS_DELTA : currentTarget + FAILURE_DELTA;
  const snapped = nearestNonBogey(raw, success);
  const clamped = Math.max(snapped, MIN_TARGET);

  return { target: clamped, completedOn170: false };
}
