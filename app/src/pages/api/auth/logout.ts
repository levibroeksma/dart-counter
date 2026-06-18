import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { assertNeonAuthConfig, forwardSetCookieHeaders, proxyAuthRequest } from "@lib/server/auth/neon";

export const POST: APIRoute = async ({ request }) => {
  try {
    assertNeonAuthConfig();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, code: MessageCode.SERVER_CONFIG }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const neonResponse = await proxyAuthRequest(request, ["sign-out"], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const json = new Response(JSON.stringify({ ok: true } satisfies ApiResponse), {
      status: neonResponse.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });

    if (!neonResponse.ok) {
      return new Response(
        JSON.stringify({ ok: false, code: MessageCode.SERVER_ERROR }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return forwardSetCookieHeaders(neonResponse, json);
  } catch (error) {
    if (error instanceof Error && error.message === MessageCode.SERVER_CONFIG) {
      return new Response(
        JSON.stringify({ ok: false, code: MessageCode.SERVER_CONFIG }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ ok: false, code: MessageCode.NETWORK_ERROR }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
