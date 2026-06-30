import { MAX_TARGET } from "./constants";
import type { TenUpOneDownCompletionReason, TenUpOneDownSession, TenUpOneDownSummary } from "./types";

/**
 * Builds end-of-game summary stats from a completed session.
 */
export function buildSummary(session: TenUpOneDownSession): TenUpOneDownSummary {
  const roundsPlayed = session.roundHistory.length;
  const checkouts = session.roundHistory.filter((round) => round.finished).length;
  const doubleAttempts = session.roundHistory.reduce(
    (sum, round) => sum + round.dartsOnDouble,
    0,
  );
  const doubleHitPercentage =
    doubleAttempts === 0 ? 0 : (checkouts / doubleAttempts) * 100;

  let peakTarget = session.state.currentTarget;
  for (const round of session.roundHistory) {
    peakTarget = Math.max(peakTarget, round.targetAtStart, round.targetAfter);
  }

  const lastRound = session.roundHistory[session.roundHistory.length - 1];
  let completionReason: TenUpOneDownCompletionReason = "rounds";
  if (lastRound?.finished && lastRound.targetAtStart === MAX_TARGET) {
    completionReason = "checkout170";
  } else if (session.settings.endMode === "timed") {
    completionReason = "timed";
  }

  return {
    completionReason,
    roundsPlayed,
    checkouts,
    doubleHitPercentage,
    finalTarget: session.state.currentTarget,
    peakTarget,
  };
}
