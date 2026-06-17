import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildSummary } from "@lib/shared/games/score-training/summary";
import { applyGameCompletionToStats } from "@lib/shared/games/score-training/stats";
import { getSession } from "@lib/server/auth/session";
import {
  deleteScoreTrainingSession,
  getScoreTrainingSession,
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

type CompletePayload = {
  timeRemainingSeconds?: number;
};

/**
 * Parses optional timer sync data from completion request body.
 */
async function parseCompletePayload(request: Request): Promise<CompletePayload> {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    return {
      timeRemainingSeconds:
        typeof payload.timeRemainingSeconds === "number"
          ? payload.timeRemainingSeconds
          : undefined,
    };
  } catch {
    return {};
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await getSession(cookies);
  if (!auth.isLoggedIn || !auth.username) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const session = await getScoreTrainingSession(auth.username);
  if (!session) {
    return jsonResponse({ ok: false, code: MessageCode.NO_ACTIVE_SESSION }, 404);
  }
  if (session.settings.endMode !== "timed") {
    return jsonResponse({ ok: false, code: MessageCode.INVALID_GAME_SETTINGS }, 400);
  }
  if (session.state.status === "completed") {
    return jsonResponse({ ok: false, code: MessageCode.GAME_COMPLETED }, 400);
  }

  try {
    const payload = await parseCompletePayload(request);
    if (typeof payload.timeRemainingSeconds === "number") {
      session.timeRemainingSeconds = payload.timeRemainingSeconds;
    }

    session.state.status = "completed";
    const summary = buildSummary(session);
    const stats = await getPlayerScoreTrainingStats(auth.username);
    applyGameCompletionToStats(stats, session);

    await savePlayerScoreTrainingStats(auth.username, stats);
    await deleteScoreTrainingSession(auth.username);

    return jsonResponse({ ok: true, session, completed: true, summary }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
