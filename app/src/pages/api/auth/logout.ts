import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { getSession } from "@lib/server/auth/session";

export const POST: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  session.destroy();

  return new Response(JSON.stringify({ ok: true } satisfies ApiResponse), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
