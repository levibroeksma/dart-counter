import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  type TenUpOneDownRoundRecord,
  validateRoundRecord,
} from "@lib/shared/games/ten-up-one-down/round";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { applyRoundToStats } from "@lib/shared/stats/double-stats";
import { getSession } from "@lib/server/auth/session";
import {
  deleteTenUpOneDownSession,
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

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await getSession(cookies);
  if (!auth.isLoggedIn || !auth.username) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const session = await getTenUpOneDownSession(auth.username);
  if (!session) {
    return jsonResponse({ ok: false, code: MessageCode.NO_ACTIVE_SESSION }, 404);
  }

  let round: TenUpOneDownRoundRecord;
  try {
    round = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const validation = validateRoundRecord(round);
  if (!validation.valid) {
    return jsonResponse({ ok: false, code: validation.code }, 400);
  }

  if (
    round.roundNumber !== session.state.currentRound ||
    round.targetAtStart !== session.state.currentTarget
  ) {
    return jsonResponse({ ok: false, code: MessageCode.INVALID_ROUND }, 400);
  }

  try {
    const stats = await getPlayerDartStats(auth.username);
    applyRoundToStats(stats, round);
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);

    await savePlayerDartStats(auth.username, stats);
    if (session.state.status === "completed") {
      await deleteTenUpOneDownSession(auth.username);
      return jsonResponse({ ok: true, session, completed: true }, 200);
    }

    await saveTenUpOneDownSession(auth.username, session);
    return jsonResponse({ ok: true, session }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
