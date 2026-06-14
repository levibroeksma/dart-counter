import type { APIRoute } from "astro";
import type { ApiResponse, GamesCatalogSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { getSession } from "@lib/server/auth/session";
import { getGameTypes } from "@lib/server/data/games";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session.isLoggedIn || !session.username) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    const games = await getGameTypes();
    const body: GamesCatalogSuccess = { ok: true, games };
    return jsonResponse(body, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
