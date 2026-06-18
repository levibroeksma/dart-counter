import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { revertRoundFromState } from "@lib/shared/games/ten-up-one-down/state";
import { revertRoundFromStats } from "@lib/shared/stats/double-stats";
import { getSession } from "@lib/server/auth/session";
import {
  getTenUpOneDownSession,
  saveTenUpOneDownSession,
} from "@lib/server/data/ten-up-one-down-session";
import {
  getPlayerDartStats,
  savePlayerDartStats,
} from "@lib/server/data/player-dart-stats";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const DELETE: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const session = await getTenUpOneDownSession(auth.userId);
  if (!session || session.roundHistory.length === 0) {
    return jsonResponse({ ok: false, code: MessageCode.INVALID_ROUND }, 400);
  }

  const removed = session.roundHistory.pop();
  if (!removed) {
    return jsonResponse({ ok: false, code: MessageCode.INVALID_ROUND }, 400);
  }

  try {
    const stats = await getPlayerDartStats(auth.userId);
    revertRoundFromStats(stats, removed);
    session.state = revertRoundFromState(session.state, removed);

    await savePlayerDartStats(auth.userId, stats);
    await saveTenUpOneDownSession(auth.userId, session);
    return jsonResponse({ ok: true, session }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
