import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { validateScoreTrainingSettings } from "@lib/shared/games/score-training/validation";
import { getSession } from "@lib/server/auth/session";
import {
  createScoreTrainingSession,
  deleteScoreTrainingSession,
  getScoreTrainingSession,
} from "@lib/server/data/score-training-session";

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

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const validated = validateScoreTrainingSettings(payload);
  if (!validated.valid) {
    return jsonResponse({ ok: false, code: validated.code }, 400);
  }

  try {
    const existing = await getScoreTrainingSession(auth.username);
    if (existing) {
      return jsonResponse({ ok: false, code: MessageCode.SESSION_EXISTS }, 409);
    }

    const created = await createScoreTrainingSession(auth.username, validated.value);
    return jsonResponse({ ok: true, session: created }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};

export const GET: APIRoute = async ({ cookies }) => {
  const auth = await getSession(cookies);
  if (!auth.isLoggedIn || !auth.username) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    const active = await getScoreTrainingSession(auth.username);
    if (!active) {
      return jsonResponse(
        { ok: false, code: MessageCode.NO_ACTIVE_SESSION },
        404
      );
    }
    return jsonResponse({ ok: true, session: active }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};

export const DELETE: APIRoute = async ({ cookies }) => {
  const auth = await getSession(cookies);
  if (!auth.isLoggedIn || !auth.username) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    await deleteScoreTrainingSession(auth.username);
    return jsonResponse({ ok: true }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
