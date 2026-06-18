# Neon Auth Astro Proxy Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each implementer subagent MUST also use superpowers:test-driven-development for code tasks and superpowers:verification-before-completion before claiming done.

**Goal:** Fix Astro dev/runtime crash by removing `@neondatabase/auth/next/server` (which eagerly imports `next/headers`) and replacing it with a fetch-based Neon Auth proxy that works in Astro SSR.

**Architecture:** Implement a framework-agnostic upstream proxy in `neon-proxy.ts` that mirrors the SDK's `handleAuthRequest` + response forwarding (without the `session_data` JWT cache). `neon.ts` keeps `AppSession`, config validation, `proxyAuthRequest()`, and `forwardSetCookieHeaders()`. The catch-all route calls `proxyAuthRequest` directly. Remove `@neondatabase/auth` and `next` dependencies — the seed script already talks to Neon Auth via raw `fetch`.

**Tech Stack:** Astro 6, `@astrojs/netlify`, TypeScript, Vitest (no Neon Auth SDK on server)

**Branch:** TBD  
**Spec:** `docs/superpowers/specs/2026-06-18-neon-auth-migration-design.md` (§2 architecture — update SDK note)  
**Prior plan:** `docs/superpowers/plans/2026-06-18-neon-auth-migration.md` (Tasks 2–4 implemented with wrong import)  
**Working directory:** `app/` (all commands run from here unless noted)

**Root cause (debugging outcome):** `@neondatabase/auth/dist/next/server/index.mjs` has a top-level `import from "next/headers"`. Any import of that entry fails under Node ESM in Astro, even when only using `.handler()`. `authApiHandler` is also not exported from that entry in v0.4.2-beta.

**Verification order (every task after Task 1):**
```
npm run check  →  npm test  →  npm run build
```

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `src/lib/server/auth/neon-proxy.ts` | **New.** Upstream fetch proxy: cookie extraction, header forwarding, Set-Cookie passthrough |
| `src/lib/server/auth/neon.ts` | **Modify.** Drop SDK import; delegate to `neon-proxy`; remove `getAuthHandler()` |
| `src/pages/api/auth/[...path].ts` | **Modify.** Call `proxyAuthRequest` instead of `getAuthHandler()` |
| `tests/lib/server/auth/neon-proxy.test.ts` | **New.** Unit tests for upstream proxy (mock `fetch`) |
| `tests/lib/server/auth/neon.test.ts` | **Modify.** Test `proxyAuthRequest` via `fetch` mock, not SDK mock |
| `tests/setup.ts` | **Modify.** Remove `@neondatabase/auth/next/server` mock |
| `package.json` | **Modify.** Remove `@neondatabase/auth` and `next` |
| `docs/superpowers/specs/2026-06-18-neon-auth-migration-design.md` | **Modify.** Correct §2 SDK choice paragraph |

**Unchanged (no edits needed):** `session.ts`, `login.ts`, `logout.ts`, `middleware.ts`, seed script, login/logout/session tests (they mock `proxyAuthRequest` or `getSession`).

**Trade-off:** Skipping the SDK's `session_data` JWT cache means every `get-session` call hits Neon Auth upstream (~200ms). Acceptable for a single-user app; avoids `jose` + `NEON_AUTH_COOKIE_SECRET` signing logic. Keep `NEON_AUTH_COOKIE_SECRET` in env for deployment parity and future cache if needed.

---

### Task 1: Fetch-Based Upstream Proxy (`neon-proxy.ts`)

**Files:**
- Create: `app/src/lib/server/auth/neon-proxy.ts`
- Create: `app/tests/lib/server/auth/neon-proxy.test.ts`

- [ ] **Step 1: Write failing tests for upstream proxy**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { proxyNeonAuthUpstream } from "@lib/server/auth/neon-proxy";

const BASE_URL = "https://test.neonauth.example/auth";

describe("proxyNeonAuthUpstream", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards Neon Auth cookies and POST body to upstream URL", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const request = new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie:
          "__Secure-neon-auth.session_token=abc; other=value; __Secure-neon-auth.local.session_data=xyz",
      },
      body: JSON.stringify({ email: "a@b.com", password: "secret" }),
    });

    await proxyNeonAuthUpstream(request, "sign-in/email", { baseUrl: BASE_URL });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/sign-in/email`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Cookie:
        "__Secure-neon-auth.session_token=abc; __Secure-neon-auth.local.session_data=xyz",
    });
    expect(init.body).toBe(JSON.stringify({ email: "a@b.com", password: "secret" }));
  });

  it("passes Set-Cookie headers from upstream to client response", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ session: {}, user: {} }), {
        status: 200,
        headers: {
          "Set-Cookie":
            "__Secure-neon-auth.session_token=tok; Path=/; HttpOnly; Secure",
        },
      })
    );

    const request = new Request("http://localhost/api/auth/get-session", {
      method: "GET",
    });

    const response = await proxyNeonAuthUpstream(request, "get-session", {
      baseUrl: BASE_URL,
    });

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual([
      "__Secure-neon-auth.session_token=tok; Path=/; HttpOnly; Secure",
    ]);
  });

  it("returns 502 JSON on upstream network failure", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));

    const request = new Request("http://localhost/api/auth/get-session", {
      method: "GET",
    });

    const response = await proxyNeonAuthUpstream(request, "get-session", {
      baseUrl: BASE_URL,
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.code).toBe("NETWORK_ERROR");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/server/auth/neon-proxy.test.ts`  
Expected: FAIL — module `@lib/server/auth/neon-proxy` not found

- [ ] **Step 3: Implement `neon-proxy.ts`**

```typescript
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

  try {
    const upstream = await fetch(upstreamUrl.toString(), { method, headers, body });
    return buildClientResponse(upstream);
  } catch {
    return Response.json(
      { error: "Unable to reach authentication service", code: "NETWORK_ERROR" },
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/lib/server/auth/neon-proxy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/auth/neon-proxy.ts tests/lib/server/auth/neon-proxy.test.ts
git commit -m "feat: add fetch-based Neon Auth upstream proxy"
```

---

### Task 2: Refactor `neon.ts` to Use Proxy (Drop SDK)

**Files:**
- Modify: `app/src/lib/server/auth/neon.ts`
- Modify: `app/tests/lib/server/auth/neon.test.ts`

- [ ] **Step 1: Write failing test for refactored `proxyAuthRequest`**

Replace entire `app/tests/lib/server/auth/neon.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forwardSetCookieHeaders, proxyAuthRequest } from "@lib/server/auth/neon";

describe("forwardSetCookieHeaders", () => {
  it("copies Set-Cookie headers onto the target response", () => {
    const source = new Response(null, {
      headers: { "Set-Cookie": "session=abc; Path=/; HttpOnly" },
    });
    const target = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    const merged = forwardSetCookieHeaders(source, target);

    expect(merged.status).toBe(200);
    expect(merged.headers.get("Content-Type")).toBe("application/json");
    expect(merged.headers.getSetCookie()).toEqual([
      "session=abc; Path=/; HttpOnly",
    ]);
  });
});

describe("proxyAuthRequest", () => {
  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = "https://test.neonauth.example/auth";
    process.env.NEON_AUTH_COOKIE_SECRET = "test-cookie-secret-at-least-32-chars";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proxies POST to upstream sign-in/email", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
    });
    const response = await proxyAuthRequest(request, ["sign-in", "email"], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "secret" }),
    });

    expect(response.status).toBe(200);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://test.neonauth.example/auth/sign-in/email");
  });

  it("throws SERVER_CONFIG when env is missing", async () => {
    delete process.env.NEON_AUTH_COOKIE_SECRET;

    const request = new Request("http://localhost/", { method: "GET" });

    await expect(proxyAuthRequest(request, ["get-session"])).rejects.toThrow(
      "SERVER_CONFIG"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/server/auth/neon.test.ts`  
Expected: FAIL — still imports SDK / wrong proxy behavior

- [ ] **Step 3: Rewrite `neon.ts`**

```typescript
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
  const config = resolveNeonAuthConfig();
  const path = pathSegments.join("/");
  return proxyNeonAuthUpstream(request, path, config, overrides);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/lib/server/auth/neon.test.ts tests/lib/server/auth/neon-proxy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/auth/neon.ts tests/lib/server/auth/neon.test.ts
git commit -m "refactor: replace Neon Auth SDK with fetch proxy in neon.ts"
```

---

### Task 3: Simplify Catch-All Auth Route

**Files:**
- Modify: `app/src/pages/api/auth/[...path].ts`

- [ ] **Step 1: Rewrite catch-all to use `proxyAuthRequest`**

```typescript
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
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`  
Expected: PASS (no references to `getAuthHandler`)

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/auth/\[...path\].ts
git commit -m "refactor: catch-all auth route uses fetch proxy"
```

---

### Task 4: Remove SDK Test Mocks

**Files:**
- Modify: `app/tests/setup.ts`

- [ ] **Step 1: Remove `@neondatabase/auth` mock from setup**

Replace entire `app/tests/setup.ts` with:

```typescript
// Global Vitest setup (add shared mocks here when needed)
```

If `tests/setup.ts` becomes empty of substance, either keep the comment-only file or remove `setupFiles` from `vitest.config.ts`. Prefer keeping the file with the comment for future shared setup.

- [ ] **Step 2: Grep for remaining SDK imports**

Run from `app/`:
```bash
grep -r "@neondatabase/auth" src/ tests/ --include='*.ts' --include='*.astro' || true
grep -r "getAuthHandler" src/ tests/ --include='*.ts' || true
grep -r "createNeonAuth" src/ tests/ --include='*.ts' || true
```

Expected: zero hits in `src/` and `tests/`

- [ ] **Step 3: Run full test suite**

Run: `npm test`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/setup.ts
git commit -m "chore: remove Neon Auth SDK vitest mocks"
```

---

### Task 5: Remove Unused Dependencies

**Files:**
- Modify: `app/package.json`
- Modify: `app/package-lock.json` (via npm)

- [ ] **Step 1: Uninstall SDK and Next.js**

Run from `app/`:
```bash
npm uninstall @neondatabase/auth next
```

Expected: `package.json` dependencies no longer list `@neondatabase/auth` or `next`.

- [ ] **Step 2: Verify no broken imports**

Run: `npm run check`  
Expected: PASS

- [ ] **Step 3: Run full verification**

Run:
```bash
npm run check
npm test
npm run build
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove @neondatabase/auth and next dependencies"
```

---

### Task 6: Update Design Spec

**Files:**
- Modify: `docs/superpowers/specs/2026-06-18-neon-auth-migration-design.md`

- [ ] **Step 1: Replace §2 SDK choice paragraph**

Find this block in §2 Architecture:

```markdown
**SDK choice:** `@neondatabase/auth` exports `authApiHandler` — framework-agnostic, uses standard `Request`/`Response`. Suitable for Astro without Next.js `cookies()` / `headers()`.

**Not used:** `createNeonAuth()` from `@neondatabase/auth/next/server` — its `signIn` / `getSession` helpers depend on `next/headers` and are incompatible with Astro.
```

Replace with:

```markdown
**Proxy choice:** Server-side auth uses a fetch-based upstream proxy (`src/lib/server/auth/neon-proxy.ts`) — no `@neondatabase/auth` server import. The SDK's `@neondatabase/auth/next/server` entry eagerly imports `next/headers` and fails under Astro SSR Node ESM. Our proxy forwards `__Secure-neon-auth.*` cookies to `NEON_AUTH_BASE_URL` and passes `Set-Cookie` back to the client.

**Not used:** `@neondatabase/auth` server SDK (`createNeonAuth`, `authApiHandler`) — Next.js-coupled bundle. Session-data JWT cache is skipped (every `get-session` hits upstream; acceptable for single-user app).
```

Also update the architecture diagram line:

```markdown
/api/auth/[...path] ──► authApiHandler (catch-all proxy for Neon Auth API)
```

to:

```markdown
/api/auth/[...path] ──► proxyAuthRequest → fetch upstream (catch-all Neon Auth API)
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-18-neon-auth-migration-design.md
git commit -m "docs: correct Neon Auth proxy architecture for Astro"
```

---

### Task 7: Final Verification (Including Dev Server)

- [ ] **Step 1: Grep cleanup**

Run from `app/`:
```bash
grep -r "@neondatabase/auth" src/ tests/ --include='*.ts' || true
grep -r "from \"next" src/ tests/ --include='*.ts' || true
grep -r "getAuthHandler\|createNeonAuth" src/ tests/ --include='*.ts' || true
```

Expected: zero hits

- [ ] **Step 2: Full CI-equivalent suite**

```bash
npm run check
npm test
npm run build
```

Expected: all PASS

- [ ] **Step 3: Dev server smoke test**

Prerequisites: `.env` has `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` (≥32 chars).

```bash
npm run dev
```

1. Open `http://localhost:4321/` — must NOT show `Cannot find module 'next/headers'`
2. Unauthenticated visit to `/` redirects to `/login`
3. Login with seeded user → lands on home
4. Logout → redirects to `/login`

- [ ] **Step 4: Optional curl check**

Run from `app/` (with dev server running):
```bash
./scripts/curl-verify-tuod.sh
```

Expected: login + game API flow succeeds

---

## Self-Review

| Requirement | Task |
|---|---|
| Remove `@neondatabase/auth/next/server` import | Tasks 2, 4, 5 |
| Fetch-based upstream proxy with cookie forwarding | Task 1 |
| `proxyAuthRequest` / `getSession` / login / logout unchanged at call-site level | Tasks 2–3 (interface preserved) |
| Catch-all route works without `getAuthHandler` | Task 3 |
| Tests no longer mask SDK with mocks | Task 4 |
| Remove `next` dependency (added as failed workaround) | Task 5 |
| Design spec corrected | Task 6 |
| `astro dev` no longer crashes | Task 7 |
| `forwardSetCookieHeaders` preserved for login/logout wrappers | Task 2 (unchanged export) |
| `NEON_AUTH_COOKIE_SECRET` env validation preserved | Task 2 |
| Seed script unchanged (already uses raw fetch) | N/A — no task needed |

**Placeholder scan:** No TBDs or "similar to Task N" references.

**Type consistency:** `proxyAuthRequest(request, pathSegments, overrides?)` signature unchanged — login/logout/session tests require no changes.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-18-neon-auth-astro-proxy-fix.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
