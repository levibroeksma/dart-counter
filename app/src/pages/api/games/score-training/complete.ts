import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { validateCompletedScoreTrainingSession } from "@lib/shared/games/score-training/completion";
import { buildSummary } from "@lib/shared/games/score-training/summary";
import { applyGameCompletionToStats } from "@lib/shared/games/score-training/stats";
import { getSession } from "@lib/server/auth/session";
import { incrementPlayCount } from "@lib/server/data/games";
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

export const POST: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const sessionPayload =
    payload && typeof payload === "object" && "session" in payload
      ? (payload as { session: unknown }).session
      : payload;

  const validated = validateCompletedScoreTrainingSession(sessionPayload);
  if (!validated.valid) {
    return jsonResponse({ ok: false, code: validated.code }, 400);
  }

  try {
    const summary = buildSummary(validated.value);
    const stats = await getPlayerScoreTrainingStats(auth.userId);
    applyGameCompletionToStats(stats, validated.value);
    await savePlayerScoreTrainingStats(auth.userId, stats);
    await incrementPlayCount(auth.userId, "score-training");
    return jsonResponse({ ok: true, summary }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
