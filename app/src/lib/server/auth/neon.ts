import { createNeonAuth } from "@neondatabase/auth/next/server";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { bootstrapEnv } from "@lib/server/bootstrap-env";

bootstrapEnv();

export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";

export type AppSession = {
  isLoggedIn: boolean;
  userId?: string;
  email?: string;
  name?: string;
};

type NeonAuthHandler = ReturnType<
  ReturnType<typeof createNeonAuth>["handler"]
>;

let cachedHandler: NeonAuthHandler | null = null;

function resolveNeonAuthConfig() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) {
    throw new Error(MessageCode.SERVER_CONFIG);
  }
  return {
    baseUrl,
    cookies: { secret },
  };
}

export function assertNeonAuthConfig(): void {
  resolveNeonAuthConfig();
}

export function getAuthHandler(): NeonAuthHandler {
  if (!cachedHandler) {
    cachedHandler = createNeonAuth(resolveNeonAuthConfig()).handler();
  }
  return cachedHandler;
}

export function forwardSetCookieHeaders(
  source: Response,
  target: Response
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
  }
): Promise<Response> {
  const origin = new URL(request.url).origin;
  const proxyUrl = new URL(
    `/api/auth/${pathSegments.join("/")}`,
    origin
  ).toString();

  const headers = new Headers(request.headers);
  if (overrides?.headers) {
    new Headers(overrides.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const proxyRequest = new Request(proxyUrl, {
    method: overrides?.method ?? request.method,
    headers,
    body: overrides?.body ?? null,
  });

  const method = (overrides?.method ?? request.method).toUpperCase();
  const handler = getAuthHandler();
  const routeHandler = handler[method as keyof NeonAuthHandler];
  if (!routeHandler) {
    return new Response("Method Not Allowed", { status: 405 });
  }

  return routeHandler(proxyRequest, {
    params: Promise.resolve({ path: pathSegments }),
  });
}
