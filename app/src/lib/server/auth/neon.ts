import { MessageCode } from "@lib/shared/constants/errors.constants";
import { bootstrapEnv } from "@lib/server/bootstrap-env";
import { proxyNeonAuthUpstream } from "@lib/server/auth/neon-proxy";

bootstrapEnv();

export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";

export type AppSession = {
  isLoggedIn: boolean;
  userId?: string;
  email?: string;
  name?: string;
};

function resolveNeonAuthConfig() {
  bootstrapEnv();
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) {
    throw new Error(MessageCode.SERVER_CONFIG);
  }
  if (secret.length < 32) {
    throw new Error(MessageCode.SERVER_CONFIG);
  }
  return { baseUrl };
}

export function assertNeonAuthConfig(): void {
  resolveNeonAuthConfig();
}

export function forwardSetCookieHeaders(
  source: Response,
  target: Response,
): Response {
  const headers = new Headers(target.headers);
  for (const cookie of source.headers.getSetCookie()) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(target.body, {
    status: target.status,
    statusText: target.statusText,
    headers,
  });
}

export async function proxyAuthRequest(
  request: Request,
  pathSegments: string[],
  overrides?: {
    method?: string;
    body?: BodyInit | null;
    headers?: HeadersInit;
  },
): Promise<Response> {
  const config = resolveNeonAuthConfig();
  const path = pathSegments.join("/");
  return proxyNeonAuthUpstream(request, path, config, overrides);
}
