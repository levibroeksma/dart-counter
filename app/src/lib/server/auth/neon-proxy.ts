/** Prefix for all Neon Auth cookies (matches @neondatabase/auth SDK). */
export const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth";

const PROXY_REQUEST_HEADERS = [
  "user-agent",
  "authorization",
  "referer",
  "content-type",
] as const;

const PROXY_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "set-cookie",
  "x-neon-ret-request-id",
] as const;

export type NeonProxyConfig = {
  baseUrl: string;
};

/**
 * Extract Neon Auth cookies from a Cookie header (prefix-filtered).
 * @param cookieHeader - Raw Cookie header value
 */
export function extractNeonAuthCookies(cookieHeader: string | null): string {
  if (!cookieHeader) return "";
  const pairs: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq);
    if (name.startsWith(NEON_AUTH_COOKIE_PREFIX)) {
      pairs.push(trimmed);
    }
  }
  return pairs.join("; ");
}

function getRequestOrigin(request: Request): string {
  return (
    request.headers.get("origin") ??
    request.headers.get("referer")?.split("/").slice(0, 3).join("/") ??
    new URL(request.url).origin
  );
}

function buildUpstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of PROXY_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Origin", getRequestOrigin(request));
  headers.set("Cookie", extractNeonAuthCookies(request.headers.get("cookie")));
  headers.set("x-neon-auth-middleware", "true");
  return headers;
}

function buildClientResponse(upstream: Response): Response {
  const headers = new Headers();
  for (const name of PROXY_RESPONSE_HEADERS) {
    if (name === "set-cookie") {
      for (const cookie of upstream.headers.getSetCookie()) {
        headers.append("Set-Cookie", cookie);
      }
    } else {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

/**
 * Proxy an auth request to the Neon Auth upstream API.
 * Framework-agnostic — safe for Astro SSR (no Next.js imports).
 */
export async function proxyNeonAuthUpstream(
  request: Request,
  path: string,
  config: NeonProxyConfig,
  overrides?: {
    method?: string;
    body?: BodyInit | null;
    headers?: HeadersInit;
  }
): Promise<Response> {
  const method = (overrides?.method ?? request.method).toUpperCase();
  const upstreamUrl = new URL(`${config.baseUrl.replace(/\/$/, "")}/${path}`);
  upstreamUrl.search = new URL(request.url).search;

  const headers = buildUpstreamHeaders(request);
  if (overrides?.headers) {
    new Headers(overrides.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  let body: BodyInit | null | undefined = overrides?.body;
  if (body === undefined && request.body) {
    body = await request.text();
  }

  const headerRecord: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerRecord[
      key === "content-type" ? "Content-Type" : key === "cookie" ? "Cookie" : key
    ] = value;
  });

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method,
      headers: headerRecord,
      body,
    });
    return buildClientResponse(upstream);
  } catch {
    return Response.json(
      { error: "Unable to reach authentication service", code: "NETWORK_ERROR" },
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
