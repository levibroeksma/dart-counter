import type { APIRoute } from "astro";
import { proxyAuthRequest } from "@lib/server/auth/neon";

function toPathSegments(param: string | undefined): string[] {
  if (!param) return [];
  return param.split("/").filter(Boolean);
}

const handle: APIRoute = async (context) => {
  const segments = toPathSegments(context.params.path);
  return proxyAuthRequest(context.request, segments);
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
