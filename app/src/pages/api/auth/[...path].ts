import type { APIRoute } from "astro";
import { getAuthHandler } from "@lib/server/auth/neon";

type AuthMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

function toPathSegments(param: string | undefined): string[] {
  if (!param) return [];
  return param.split("/").filter(Boolean);
}

const handle: APIRoute = async (context) => {
  const segments = toPathSegments(context.params.path);
  const method = context.request.method.toUpperCase() as AuthMethod;
  const handler = getAuthHandler()[method];

  if (!handler) {
    return new Response("Method Not Allowed", { status: 405 });
  }

  return handler(context.request, {
    params: Promise.resolve({ path: segments }),
  });
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
