/** Prefix for all Neon Auth cookies (matches @neondatabase/auth SDK). */
const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth";

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
function extractNeonAuthCookies(cookieHeader: string | null): string {
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

/**
 * Public site origin for Neon Auth sign-in/sign-up (must match trusted domains).
 * Netlify SSR may expose an internal `request.url` origin; prefer configured URL.
 */
function resolvePublicOrigin(request: Request): string | undefined {
  for (const value of [
    process.env.APP_ORIGIN,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
  ]) {
    if (value) return value.replace(/\/$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost.split(",")[0]?.trim()}`;
  }

  return undefined;
}

function getRequestOrigin(request: Request): string {
  return (
    resolvePublicOrigin(request) ??
    request.headers.get("origin") ??
    request.headers.get("referer")?.split("/").slice(0, 3).join("/") ??
    new URL(request.url).origin
  );
}

function buildUpstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = getRequestOrigin(request);

  for (const name of PROXY_REQUEST_HEADERS) {
    if (name === "referer") continue;
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set("Origin", origin);
  headers.set("Referer", `${origin}/`);
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

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method,
      headers,
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
