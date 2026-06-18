import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { validateTenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/validation";
import { getSession } from "@lib/server/auth/session";
import {
  createTenUpOneDownSession,
  deleteTenUpOneDownSession,
  getTenUpOneDownSession,
} from "@lib/server/data/ten-up-one-down-session";

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

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const validated = validateTenUpOneDownSettings(payload);
  if (!validated.valid) {
    return jsonResponse({ ok: false, code: validated.code }, 400);
  }

  try {
    const existing = await getTenUpOneDownSession(auth.userId);
    if (existing) {
      return jsonResponse({ ok: false, code: MessageCode.SESSION_EXISTS }, 409);
    }

    const created = await createTenUpOneDownSession(auth.userId, validated.value);
    return jsonResponse({ ok: true, session: created }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};

export const GET: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    const active = await getTenUpOneDownSession(auth.userId);
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

export const DELETE: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    await deleteTenUpOneDownSession(auth.userId);
    return jsonResponse({ ok: true }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
