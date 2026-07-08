import type { APIRoute } from "astro";
import type { ApiResponse, ProfileDashboardSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { getSession } from "@lib/server/auth/session";
import { getProfileDashboardData } from "@lib/server/data/player-stat-completions";
import { getPreferences } from "@lib/server/data/preferences";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session.isLoggedIn || !session.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    const [dashboard, prefs] = await Promise.all([
      getProfileDashboardData(session.userId),
      getPreferences(session.userId),
    ]);

    const body: ProfileDashboardSuccess = {
      ok: true,
      metrics: dashboard.metrics,
      sparklines: dashboard.sparklines,
      gamesPlayed: dashboard.gamesPlayed,
      gamesWon: dashboard.gamesWon,
    };
    if (prefs.displayName) {
      body.displayName = prefs.displayName;
    }
    return jsonResponse(body, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
