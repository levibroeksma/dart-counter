import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { assertNeonAuthConfig, forwardSetCookieHeaders, proxyAuthRequest } from "@lib/server/auth/neon";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    assertNeonAuthConfig();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_CONFIG }, 500);
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  try {
    const neonResponse = await proxyAuthRequest(request, ["sign-in", "email"], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!neonResponse.ok) {
      const status = neonResponse.status === 401 ? 401 : 500;
      const code =
        neonResponse.status === 401
          ? MessageCode.INVALID_CREDENTIALS
          : MessageCode.SERVER_ERROR;
      return jsonResponse({ ok: false, code }, status);
    }

    return forwardSetCookieHeaders(neonResponse, jsonResponse({ ok: true }, 200));
  } catch (error) {
    if (error instanceof Error && error.message === MessageCode.SERVER_CONFIG) {
      return jsonResponse({ ok: false, code: MessageCode.SERVER_CONFIG }, 500);
    }
    return jsonResponse({ ok: false, code: MessageCode.NETWORK_ERROR }, 500);
  }
};
