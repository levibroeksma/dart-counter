import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  applyGameCompletionToStats,
  buildSummary,
  validateCompletedSinglesTrainingSession,
} from "@lib/shared/games/singles-training";
import { buildSinglesTrainingCompletionSnapshot } from "@lib/shared/stats";
import { getSession } from "@lib/server/auth/session";
import { incrementPlayCount } from "@lib/server/data/games";
import {
  getPlayerSinglesTrainingStats,
  savePlayerSinglesTrainingStats,
} from "@lib/server/data/player-singles-training-stats";
import { insertPlayerStatCompletion } from "@lib/server/data/player-stat-completions";

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

  const validated = validateCompletedSinglesTrainingSession(sessionPayload);
  if (!validated.valid) {
    return jsonResponse({ ok: false, code: validated.code }, 400);
  }

  try {
    const summary = buildSummary(validated.value);
    const stats = await getPlayerSinglesTrainingStats(auth.userId);
    applyGameCompletionToStats(stats, validated.value);
    await savePlayerSinglesTrainingStats(auth.userId, stats);
    const snapshot = buildSinglesTrainingCompletionSnapshot(validated.value);
    await insertPlayerStatCompletion(auth.userId, snapshot);
    await incrementPlayCount(auth.userId, "singles-training");
    return jsonResponse({ ok: true, summary }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
