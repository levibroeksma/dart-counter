import type { APIRoute } from "astro";
import type { ApiResponse, PreferencesSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { getSession } from "@lib/server/auth/session";
import {
  getPreferences,
  setPreferences,
  type UserPreferences,
} from "@lib/server/data/preferences";
import { validateDisplayName } from "@lib/shared/validation/display-name";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session.isLoggedIn) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    const prefs = await getPreferences();
    const body: PreferencesSuccess = { ok: true };
    if (prefs.displayName) {
      body.displayName = prefs.displayName;
    }
    return jsonResponse(body, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session.isLoggedIn) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  let body: { displayName?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const validated = validateDisplayName(body.displayName ?? "");
  if (!validated.valid) {
    return jsonResponse({ ok: false, code: validated.code }, 400);
  }

  const prefs: UserPreferences = {};
  if (validated.value) {
    prefs.displayName = validated.value;
  }

  try {
    await setPreferences(prefs);
    const response: PreferencesSuccess = { ok: true };
    if (validated.value) {
      response.displayName = validated.value;
    }
    return jsonResponse(response, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
