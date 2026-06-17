import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { revertRoundFromState } from "@lib/shared/games/score-training/state";
import { getSession } from "@lib/server/auth/session";
import {
  getScoreTrainingSession,
  saveScoreTrainingSession,
} from "@lib/server/data/score-training-session";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const DELETE: APIRoute = async ({ cookies }) => {
  const auth = await getSession(cookies);
  if (!auth.isLoggedIn || !auth.username) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const session = await getScoreTrainingSession(auth.username);
  if (!session) {
    return jsonResponse({ ok: false, code: MessageCode.NO_ACTIVE_SESSION }, 404);
  }
  if (session.roundHistory.length === 0) {
    return jsonResponse({ ok: false, code: MessageCode.NO_ROUNDS_TO_UNDO }, 400);
  }

  const previousLastScore =
    session.roundHistory[session.roundHistory.length - 2]?.visitScore ?? null;
  const removedRound = session.roundHistory.pop();
  if (!removedRound) {
    return jsonResponse({ ok: false, code: MessageCode.NO_ROUNDS_TO_UNDO }, 400);
  }

  try {
    session.state = revertRoundFromState(
      session.state,
      removedRound,
      previousLastScore
    );
    await saveScoreTrainingSession(auth.username, session);
    return jsonResponse({ ok: true, session }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
