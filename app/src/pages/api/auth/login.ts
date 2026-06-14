import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  assertAuthConfig,
  validateCredentials,
} from "@lib/server/auth/credentials";
import { getSession } from "@lib/server/auth/session";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    assertAuthConfig();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_CONFIG }, 500);
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  try {
    if (!validateCredentials(username, password)) {
      return jsonResponse(
        { ok: false, code: MessageCode.INVALID_CREDENTIALS },
        401
      );
    }
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_CONFIG }, 500);
  }

  const session = await getSession(cookies);
  session.isLoggedIn = true;
  session.username = username;
  await session.save();

  return jsonResponse({ ok: true }, 200);
};
