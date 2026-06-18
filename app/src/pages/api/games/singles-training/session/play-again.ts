import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import type { SinglesTrainingSettings } from "@lib/shared/games/singles-training/settings";
import { validateSinglesTrainingSettings } from "@lib/shared/games/singles-training/validation";
import { getSession } from "@lib/server/auth/session";
import {
  createSinglesTrainingSession,
  deleteSinglesTrainingSession,
  getSinglesTrainingSession,
} from "@lib/server/data/singles-training-session";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function resolveSettings(
  request: Request,
  userId: string,
): Promise<SinglesTrainingSettings | typeof MessageCode.NO_ACTIVE_SESSION | null> {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const validated = validateSinglesTrainingSettings(payload);
    if (validated.valid) {
      return validated.value;
    }
    return null;
  } catch {
    const existing = await getSinglesTrainingSession(userId);
    if (!existing) {
      return MessageCode.NO_ACTIVE_SESSION;
    }
    return existing.settings;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    const settings = await resolveSettings(request, auth.userId);
    if (settings === MessageCode.NO_ACTIVE_SESSION) {
      return jsonResponse({ ok: false, code: MessageCode.NO_ACTIVE_SESSION }, 404);
    }
    if (!settings) {
      return jsonResponse({ ok: false, code: MessageCode.INVALID_GAME_SETTINGS }, 400);
    }

    await deleteSinglesTrainingSession(auth.userId);
    const nextSession = await createSinglesTrainingSession(auth.userId, settings);
    return jsonResponse({ ok: true, session: nextSession }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
