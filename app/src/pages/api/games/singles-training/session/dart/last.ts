import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { revertLastDart } from "@lib/shared/games/singles-training/state";
import { getSession } from "@lib/server/auth/session";
import {
  getSinglesTrainingSession,
  saveSinglesTrainingSession,
} from "@lib/server/data/singles-training-session";

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

  const session = await getSinglesTrainingSession(auth.userId);
  if (!session) {
    return jsonResponse({ ok: false, code: MessageCode.NO_ACTIVE_SESSION }, 404);
  }
  if (session.dartHistory.length === 0) {
    return jsonResponse({ ok: false, code: MessageCode.NO_DARTS_TO_UNDO }, 400);
  }

  try {
    const revertedSession = revertLastDart(session);
    await saveSinglesTrainingSession(auth.userId, revertedSession);
    return jsonResponse({ ok: true, session: revertedSession }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
