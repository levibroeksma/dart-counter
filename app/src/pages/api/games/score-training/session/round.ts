import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  type ScoreTrainingRoundRecord,
  validateRoundRecord,
} from "@lib/shared/games/score-training/round";
import { applyRoundToState } from "@lib/shared/games/score-training/state";
import { buildSummary } from "@lib/shared/games/score-training/summary";
import { applyGameCompletionToStats } from "@lib/shared/games/score-training/stats";
import { getSession } from "@lib/server/auth/session";
import {
  deleteScoreTrainingSession,
  getScoreTrainingSession,
  saveScoreTrainingSession,
} from "@lib/server/data/score-training-session";
import {
  getPlayerScoreTrainingStats,
  savePlayerScoreTrainingStats,
} from "@lib/server/data/player-score-training-stats";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type RoundSubmissionPayload = {
  round: ScoreTrainingRoundRecord;
  timeRemainingSeconds?: number;
  timerExpired?: boolean;
};

/**
 * Validates and normalizes the accepted round submission payload.
 */
function parseRoundSubmission(payload: unknown): RoundSubmissionPayload | null {
  if (!payload || typeof payload !== "object" || !("round" in payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (!record.round || typeof record.round !== "object") {
    return null;
  }

  return {
    round: record.round as ScoreTrainingRoundRecord,
    timeRemainingSeconds:
      typeof record.timeRemainingSeconds === "number"
        ? record.timeRemainingSeconds
        : undefined,
    timerExpired: record.timerExpired === true,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const session = await getScoreTrainingSession(auth.userId);
  if (!session) {
    return jsonResponse({ ok: false, code: MessageCode.NO_ACTIVE_SESSION }, 404);
  }
  if (session.state.status === "completed") {
    return jsonResponse({ ok: false, code: MessageCode.GAME_COMPLETED }, 400);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const parsed = parseRoundSubmission(payload);
  if (!parsed) {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const validation = validateRoundRecord(parsed.round, session.state.currentRound);
  if (!validation.valid) {
    return jsonResponse({ ok: false, code: validation.code }, 400);
  }

  try {
    if (typeof parsed.timeRemainingSeconds === "number") {
      session.timeRemainingSeconds = parsed.timeRemainingSeconds;
    }

    session.state = applyRoundToState(
      session.state,
      parsed.round,
      session.settings,
      parsed.timerExpired === true
    );
    session.roundHistory.push(parsed.round);

    if (session.state.status === "completed") {
      const summary = buildSummary(session);
      const stats = await getPlayerScoreTrainingStats(auth.userId);
      applyGameCompletionToStats(stats, session);
      await savePlayerScoreTrainingStats(auth.userId, stats);
      await deleteScoreTrainingSession(auth.userId);
      return jsonResponse({ ok: true, session, completed: true, summary }, 200);
    }

    await saveScoreTrainingSession(auth.userId, session);
    return jsonResponse({ ok: true, session }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
