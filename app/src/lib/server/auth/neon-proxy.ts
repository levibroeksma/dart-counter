/** Prefix for all Neon Auth cookies (matches @neondatabase/auth SDK). */
const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth";

/** Dev-only prefix when relaxing Secure cookies for LAN HTTP (e.g. Astro --host). */
const DEV_HTTP_COOKIE_PREFIX = "neon-auth.dev";

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
    const value = trimmed.slice(eq + 1);
    if (name.startsWith(DEV_HTTP_COOKIE_PREFIX)) {
      pairs.push(
        `${NEON_AUTH_COOKIE_PREFIX}${name.slice(DEV_HTTP_COOKIE_PREFIX.length)}=${value}`,
      );
    } else if (name.startsWith(NEON_AUTH_COOKIE_PREFIX)) {
      pairs.push(trimmed);
    }
  }
  return pairs.join("; ");
}

function needsDevHttpCookieRelaxation(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const url = new URL(request.url);
  if (url.protocol !== "http:") return false;
  const host = url.hostname;
  return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
}

/** Strip Secure flags and rename prefix so browsers accept cookies on LAN HTTP dev. */
function relaxSetCookieForDevHttp(cookie: string): string {
  if (!cookie.startsWith(NEON_AUTH_COOKIE_PREFIX)) return cookie;
  let result =
    DEV_HTTP_COOKIE_PREFIX + cookie.slice(NEON_AUTH_COOKIE_PREFIX.length);
  result = result
    .replace(/;\s*Secure(?=;|$)/gi, "")
    .replace(/;\s*Partitioned(?=;|$)/gi, "")
    .replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
  return result;
}

/**
 * Public site origin for Neon Auth sign-in/sign-up (must match trusted domains).
 * Netlify SSR may expose an internal `request.url` origin; prefer configured URL.
 * In local dev, ignore Netlify deploy URLs so browser origin is used instead.
 */
function resolvePublicOrigin(request: Request): string | undefined {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredOrigins = isProduction
    ? [process.env.APP_ORIGIN, process.env.URL, process.env.DEPLOY_PRIME_URL]
    : [
        process.env.SEED_AUTH_ORIGIN,
        process.env.APP_ORIGIN,
        "http://localhost:4321",
      ];

  for (const value of configuredOrigins) {
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

function buildClientResponse(
  upstream: Response,
  request: Request,
): Response {
  const headers = new Headers();
  const relaxCookies = needsDevHttpCookieRelaxation(request);
  for (const name of PROXY_RESPONSE_HEADERS) {
    if (name === "set-cookie") {
      for (const cookie of upstream.headers.getSetCookie()) {
        headers.append(
          "Set-Cookie",
          relaxCookies ? relaxSetCookieForDevHttp(cookie) : cookie,
        );
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
  },
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
    return buildClientResponse(upstream, request);
  } catch {
    return Response.json(
      {
        error: "Unable to reach authentication service",
        code: "NETWORK_ERROR",
      },
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
