import type { SimulatedVisit } from "@lib/shared/dartbot/types";

type DelayResult = "elapsed" | "aborted";

export type AnimateDartBotVisitOptions = {
  dartMs?: number;
  onDart?: (segmentLabel: string, index: number) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
};

/**
 * Animates a simulated DartBot visit by emitting one landed segment per step.
 */
export async function animateDartBotVisit(
  visit: SimulatedVisit,
  options: AnimateDartBotVisitOptions = {},
): Promise<void> {
  const { dartMs = 550, onDart, onComplete, signal } = options;

  for (let index = 0; index < visit.darts.length; index += 1) {
    const result = await delayWithVisibilityPause(dartMs, signal);
    if (result === "aborted") break;
    const segmentLabel = visit.darts[index]?.actual.label;
    if (!segmentLabel) continue;
    onDart?.(segmentLabel, index);
  }

  onComplete?.();
}

/**
 * Waits for a delay while pausing countdown when the page is hidden.
 */
function delayWithVisibilityPause(
  ms: number,
  signal?: AbortSignal,
): Promise<DelayResult> {
  if (signal?.aborted) return Promise.resolve("aborted");
  if (ms <= 0) return Promise.resolve("elapsed");

  return new Promise<DelayResult>((resolve) => {
    let remainingMs = ms;
    let startedAtMs = 0;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const done = (result: DelayResult) => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
        timerId = undefined;
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    const startTimer = () => {
      if (timerId !== undefined || document.hidden) return;
      startedAtMs = Date.now();
      timerId = setTimeout(() => done("elapsed"), remainingMs);
    };

    const pauseTimer = () => {
      if (timerId === undefined) return;
      clearTimeout(timerId);
      timerId = undefined;
      const elapsedMs = Date.now() - startedAtMs;
      remainingMs = Math.max(0, remainingMs - elapsedMs);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        pauseTimer();
        return;
      }
      if (remainingMs <= 0) {
        done("elapsed");
        return;
      }
      startTimer();
    };

    const onAbort = () => done("aborted");

    document.addEventListener("visibilitychange", onVisibilityChange);
    signal?.addEventListener("abort", onAbort, { once: true });
    startTimer();
  });
}
