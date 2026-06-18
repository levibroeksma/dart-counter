import type { APIRoute } from "astro";
import type { ApiResponse, GameConfigSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { getSession } from "@lib/server/auth/session";
import {
  getGameBySlug,
  getGameConfig,
  saveGameConfig,
} from "@lib/server/data/games";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ params, request }) => {
  const session = await getSession(request);
  if (!session.isLoggedIn || !session.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const slug = params.slug ?? "";
  const game = await getGameBySlug(slug);
  if (!game) {
    return jsonResponse({ ok: false, code: MessageCode.UNKNOWN_GAME }, 404);
  }

  try {
    const config = await getGameConfig(session.userId, slug);
    const body: GameConfigSuccess = {
      ok: true,
      config: config ?? { slug, settings: {}, updatedAt: "" },
    };
    return jsonResponse(body, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const session = await getSession(request);
  if (!session.isLoggedIn || !session.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const slug = params.slug ?? "";
  const game = await getGameBySlug(slug);
  if (!game) {
    return jsonResponse({ ok: false, code: MessageCode.UNKNOWN_GAME }, 404);
  }

  let body: { settings?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  if (!body.settings || typeof body.settings !== "object") {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  try {
    const config = await saveGameConfig(
      session.userId,
      slug,
      body.settings
    );
    const response: GameConfigSuccess = { ok: true, config };
    return jsonResponse(response, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
