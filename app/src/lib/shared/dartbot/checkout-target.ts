import { getCheckoutHint } from "@lib/shared/darts";
import { parseSegment } from "./segments";
import type { Segment } from "./types";

/**
 * Resolves the first checkout hint segment for the current remaining score.
 */
export function nextCheckoutTarget(remaining: number): Segment | null {
  const hint = getCheckoutHint(remaining);
  if (!hint?.segments[0]) return null;
  return parseSegment(hint.segments[0]);
}
