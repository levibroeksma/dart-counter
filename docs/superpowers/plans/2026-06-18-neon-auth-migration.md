# Neon Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each implementer subagent MUST also use superpowers:test-driven-development for code tasks and superpowers:verification-before-completion before claiming done.

**Goal:** Replace env-based credentials and `iron-session` with Neon Auth (managed Better Auth), keeping the Alpine login form and switching identity keys from `username` to `userId`.

**Architecture:** Astro API routes proxy auth to Neon via `authApiHandler` from `@neondatabase/auth/next/server` (Request/Response only — do not use `createNeonAuth().signIn` / `.getSession`, which depend on `next/headers`). Named routes `/api/auth/login` and `/api/auth/logout` wrap `sign-in/email` and `sign-out`; catch-all `/api/auth/[...path]` handles remaining Neon Auth APIs. `getSession(request)` calls proxied `get-session` and returns `AppSession`.

**Tech Stack:** Astro 6, `@astrojs/netlify`, `@neondatabase/auth`, Alpine.js 3, TypeScript, Vitest

**Branch:** TBD  
**Spec:** `docs/superpowers/specs/2026-06-18-neon-auth-migration-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

**Test constants (use everywhere):**
```typescript
export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
export const TEST_USER_EMAIL = "test@example.com";
```

**Verification order (every task after Task 1):**
```
npm run check  →  npm test  →  npm run build
```

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `src/lib/server/auth/neon.ts` | Neon config, `authApiHandler` singleton, `proxyAuthRequest()`, `forwardSetCookieHeaders()`, `AppSession` type |
| `src/lib/server/auth/session.ts` | `getSession(request)` via proxied `get-session` |
| `src/pages/api/auth/[...path].ts` | Catch-all Neon Auth proxy |
| `src/pages/api/auth/login.ts` | Proxy `sign-in/email`, forward `Set-Cookie` |
| `src/pages/api/auth/logout.ts` | Proxy `sign-out`, forward cookie clearing |
| `scripts/seed-neon-auth-user.ts` | One-time `sign-up/email` for single user |
| `src/middleware.ts` | `getSession(context.request)` |
| `src/lib/client/alpine/forms/login.form.ts` | Email + password POST body |
| `src/components/forms/LoginForm.astro` | Email field UI |
| `src/lib/shared/constants/errors.constants.ts` | Email-oriented error copy |
| `src/lib/server/bootstrap-env.ts` | Drop legacy `AUTH_*` / `SESSION_SECRET` early-return |
| `.env.example` | Neon auth vars only |
| `vitest.config.ts` | Neon auth test env |
| `scripts/curl-verify-tuod.sh` | `AUTH_EMAIL` login body |
| 15 production source files | `session.username` / `auth.username` → `userId` |
| 22 test files | Mock `AppSession` with `userId` UUID |
| 4 docs files | Update active context/spec cross-refs |

**Deleted:** `src/lib/server/auth/credentials.ts`, `tests/lib/server/auth/credentials.test.ts`

---

### Task 1: Swap Dependencies and Test Env

**Files:**
- Modify: `app/package.json`
- Modify: `app/vitest.config.ts`
- Modify: `app/.env.example`

- [ ] **Step 1: Install Neon Auth, remove iron-session**

Run from `app/`:
```bash
npm install @neondatabase/auth@latest
npm uninstall iron-session
```

Expected: `package.json` dependencies list `@neondatabase/auth`, no `iron-session`.

- [ ] **Step 2: Update `vitest.config.ts` test env**

Replace the `env` block:
```typescript
env: {
  NEON_AUTH_BASE_URL: "https://test.neonauth.example/auth",
  NEON_AUTH_COOKIE_SECRET: "test-cookie-secret-at-least-32-chars",
  NODE_ENV: "test",
},
```

- [ ] **Step 3: Update `.env.example`**

```dotenv
# Neon (populated by `neonctl env pull`)
NEON_BRANCH=production
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:password@host/neondb?sslmode=require
NEON_AUTH_BASE_URL=https://your-endpoint.neonauth.region.aws.neon.tech/neondb/auth
NEON_AUTH_JWKS_URL=https://your-endpoint.neonauth.region.aws.neon.tech/neondb/auth/.well-known/jwks.json
NEON_AUTH_COOKIE_SECRET=generate-with-openssl-rand-base64-32
```

Remove `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET`.

- [ ] **Step 4: Verify install**

Run: `npm run check`  
Expected: PASS (no iron-session import errors yet — credentials still present)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.example
git commit -m "chore: swap iron-session for @neondatabase/auth"
```

---

### Task 2: Neon Auth Proxy Helpers (`neon.ts`)

**Files:**
- Create: `app/src/lib/server/auth/neon.ts`
- Create: `app/tests/lib/server/auth/neon.test.ts`

- [ ] **Step 1: Write failing tests for Set-Cookie forwarding**

```typescript
import { describe, it, expect } from "vitest";
import { forwardSetCookieHeaders } from "@lib/server/auth/neon";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/server/auth/neon.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement `neon.ts`**

```typescript
import { authApiHandler } from "@neondatabase/auth/next/server";
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

type NeonAuthHandler = ReturnType<typeof authApiHandler>;

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

export function getAuthHandler(): NeonAuthHandler {
  if (!cachedHandler) {
    cachedHandler = authApiHandler(resolveNeonAuthConfig());
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
```

- [ ] **Step 4: Add proxy path test (mock handler)**

Append to `neon.test.ts`:
```typescript
import { vi, beforeEach } from "vitest";
import { proxyAuthRequest, getAuthHandler } from "@lib/server/auth/neon";

vi.mock("@neondatabase/auth/next/server", () => ({
  authApiHandler: vi.fn(() => ({
    POST: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
  })),
}));

describe("proxyAuthRequest", () => {
  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = "https://test.neonauth.example/auth";
    process.env.NEON_AUTH_COOKIE_SECRET = "test-cookie-secret-at-least-32-chars";
  });

  it("routes POST to authApiHandler with path segments", async () => {
    const request = new Request("http://localhost/api/auth/login", { method: "POST" });
    const response = await proxyAuthRequest(request, ["sign-in", "email"], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "secret" }),
    });

    expect(response.status).toBe(200);
    const handler = getAuthHandler();
    expect(handler.POST).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/lib/server/auth/neon.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/auth/neon.ts tests/lib/server/auth/neon.test.ts
git commit -m "feat: add Neon Auth proxy helpers"
```

---

### Task 3: Rewrite `session.ts` for `AppSession`

**Files:**
- Rewrite: `app/src/lib/server/auth/session.ts`
- Rewrite: `app/tests/lib/server/auth/session.test.ts`

- [ ] **Step 1: Write failing session tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSession } from "@lib/server/auth/session";
import { TEST_USER_ID } from "@lib/server/auth/neon";

const mockProxy = vi.fn();

vi.mock("@lib/server/auth/neon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/server/auth/neon")>();
  return {
    ...actual,
    proxyAuthRequest: (...args: unknown[]) => mockProxy(...args),
  };
});

describe("getSession", () => {
  beforeEach(() => {
    mockProxy.mockReset();
  });

  it("returns logged-out session when get-session has no user", async () => {
    mockProxy.mockResolvedValue(
      new Response(JSON.stringify({ session: null, user: null }), { status: 200 })
    );

    const session = await getSession(new Request("http://localhost/"));

    expect(session).toEqual({ isLoggedIn: false });
  });

  it("maps Neon user to AppSession", async () => {
    mockProxy.mockResolvedValue(
      new Response(
        JSON.stringify({
          session: { id: "sess-1" },
          user: { id: TEST_USER_ID, email: "test@example.com", name: "Test" },
        }),
        { status: 200 }
      )
    );

    const session = await getSession(new Request("http://localhost/"));

    expect(session).toEqual({
      isLoggedIn: true,
      userId: TEST_USER_ID,
      email: "test@example.com",
      name: "Test",
    });
  });

  it("returns logged-out session on proxy failure", async () => {
    mockProxy.mockResolvedValue(new Response("error", { status: 500 }));

    const session = await getSession(new Request("http://localhost/"));

    expect(session).toEqual({ isLoggedIn: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/server/auth/session.test.ts`  
Expected: FAIL — iron-session exports / wrong signature

- [ ] **Step 3: Rewrite `session.ts`**

```typescript
import { proxyAuthRequest, type AppSession } from "@lib/server/auth/neon";
import { bootstrapEnv } from "@lib/server/bootstrap-env";

bootstrapEnv();

export type { AppSession } from "@lib/server/auth/neon";

export async function getSession(request: Request): Promise<AppSession> {
  try {
    const response = await proxyAuthRequest(request, ["get-session"], {
      method: "GET",
    });

    if (!response.ok) {
      return { isLoggedIn: false };
    }

    const data = (await response.json()) as {
      user?: { id?: string; email?: string; name?: string };
    };

    if (!data.user?.id) {
      return { isLoggedIn: false };
    }

    return {
      isLoggedIn: true,
      userId: data.user.id,
      email: data.user.email,
      name: data.user.name,
    };
  } catch {
    return { isLoggedIn: false };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/lib/server/auth/session.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/auth/session.ts tests/lib/server/auth/session.test.ts
git commit -m "feat: replace iron-session with Neon get-session proxy"
```

---

### Task 4: Catch-All Auth Proxy Route

**Files:**
- Create: `app/src/pages/api/auth/[...path].ts`

- [ ] **Step 1: Create catch-all route**

```typescript
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
```

- [ ] **Step 2: Verify types**

Run: `npm run check`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/auth/\[...path\].ts
git commit -m "feat: add Neon Auth catch-all proxy route"
```

---

### Task 5: Rewrite Login API

**Files:**
- Rewrite: `app/src/pages/api/auth/login.ts`
- Rewrite: `app/tests/api/auth/login.test.ts`
- Delete: `app/src/lib/server/auth/credentials.ts`
- Delete: `app/tests/lib/server/auth/credentials.test.ts`

- [ ] **Step 1: Write failing login tests**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../src/pages/api/auth/login";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockProxy = vi.fn();

vi.mock("@lib/server/auth/neon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/server/auth/neon")>();
  return {
    ...actual,
    proxyAuthRequest: (...args: unknown[]) => mockProxy(...args),
  };
});

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockProxy.mockReset();
    process.env.NEON_AUTH_BASE_URL = "https://test.neonauth.example/auth";
    process.env.NEON_AUTH_COOKIE_SECRET = "test-cookie-secret-at-least-32-chars";
  });

  it("returns 200 and forwards Set-Cookie on success", async () => {
    mockProxy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Set-Cookie": "neon_session=abc; Path=/; HttpOnly" },
      })
    );

    const response = await POST(
      createContext({ email: "test@example.com", password: "testpass" })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(response.headers.getSetCookie()).toEqual([
      "neon_session=abc; Path=/; HttpOnly",
    ]);
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(Request),
      ["sign-in", "email"],
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns 401 for invalid credentials", async () => {
    mockProxy.mockResolvedValue(new Response(JSON.stringify({ error: "bad" }), { status: 401 }));

    const response = await POST(
      createContext({ email: "wrong@example.com", password: "wrong" })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.INVALID_CREDENTIALS });
  });

  it("returns 400 when email is missing", async () => {
    const response = await POST(createContext({ password: "testpass" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.MISSING_FIELDS });
  });

  it("returns 400 when password is missing", async () => {
    const response = await POST(createContext({ email: "test@example.com" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.MISSING_FIELDS });
  });

  it("returns 500 when Neon auth env is missing", async () => {
    delete process.env.NEON_AUTH_COOKIE_SECRET;
    const response = await POST(
      createContext({ email: "test@example.com", password: "testpass" })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_CONFIG });
  });

  it("returns 500 when Neon is unreachable", async () => {
    mockProxy.mockRejectedValue(new Error("network"));

    const response = await POST(
      createContext({ email: "test@example.com", password: "testpass" })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.NETWORK_ERROR });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/auth/login.test.ts`  
Expected: FAIL

- [ ] **Step 3: Rewrite `login.ts`**

```typescript
import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { forwardSetCookieHeaders, proxyAuthRequest } from "@lib/server/auth/neon";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  try {
    const neonResponse = await proxyAuthRequest(request, ["sign-in", "email"], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!neonResponse.ok) {
      const status = neonResponse.status === 401 ? 401 : 500;
      const code =
        neonResponse.status === 401
          ? MessageCode.INVALID_CREDENTIALS
          : MessageCode.SERVER_ERROR;
      return jsonResponse({ ok: false, code }, status);
    }

    return forwardSetCookieHeaders(neonResponse, jsonResponse({ ok: true }, 200));
  } catch (error) {
    if (error instanceof Error && error.message === MessageCode.SERVER_CONFIG) {
      return jsonResponse({ ok: false, code: MessageCode.SERVER_CONFIG }, 500);
    }
    return jsonResponse({ ok: false, code: MessageCode.NETWORK_ERROR }, 500);
  }
};
```

- [ ] **Step 4: Delete credentials module and test**

```bash
rm src/lib/server/auth/credentials.ts tests/lib/server/auth/credentials.test.ts
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/api/auth/login.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/auth/login.ts tests/api/auth/login.test.ts
git add -u src/lib/server/auth/credentials.ts tests/lib/server/auth/credentials.test.ts
git commit -m "feat: proxy login through Neon sign-in/email"
```

---

### Task 6: Rewrite Logout API

**Files:**
- Rewrite: `app/src/pages/api/auth/logout.ts`
- Rewrite: `app/tests/api/auth/logout.test.ts`

- [ ] **Step 1: Write failing logout tests**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../src/pages/api/auth/logout";

const mockProxy = vi.fn();

vi.mock("@lib/server/auth/neon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/server/auth/neon")>();
  return {
    ...actual,
    proxyAuthRequest: (...args: unknown[]) => mockProxy(...args),
  };
});

function createContext(): APIContext {
  return {
    request: new Request("http://localhost/api/auth/logout", { method: "POST" }),
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    mockProxy.mockReset();
    process.env.NEON_AUTH_BASE_URL = "https://test.neonauth.example/auth";
    process.env.NEON_AUTH_COOKIE_SECRET = "test-cookie-secret-at-least-32-chars";
  });

  it("proxies sign-out and forwards clearing cookies", async () => {
    mockProxy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Set-Cookie": "neon_session=; Max-Age=0; Path=/" },
      })
    );

    const response = await POST(createContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(Request),
      ["sign-out"],
      expect.objectContaining({ method: "POST" })
    );
    expect(response.headers.getSetCookie()).toEqual([
      "neon_session=; Max-Age=0; Path=/",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/auth/logout.test.ts`  
Expected: FAIL

- [ ] **Step 3: Rewrite `logout.ts`**

```typescript
import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { forwardSetCookieHeaders, proxyAuthRequest } from "@lib/server/auth/neon";

export const POST: APIRoute = async ({ request }) => {
  try {
    const neonResponse = await proxyAuthRequest(request, ["sign-out"], {
      method: "POST",
    });

    const json = new Response(JSON.stringify({ ok: true } satisfies ApiResponse), {
      status: neonResponse.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });

    if (!neonResponse.ok) {
      return new Response(JSON.stringify({ ok: false, code: MessageCode.SERVER_ERROR }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return forwardSetCookieHeaders(neonResponse, json);
  } catch (error) {
    if (error instanceof Error && error.message === MessageCode.SERVER_CONFIG) {
      return new Response(
        JSON.stringify({ ok: false, code: MessageCode.SERVER_CONFIG }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ ok: false, code: MessageCode.NETWORK_ERROR }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/api/auth/logout.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/auth/logout.ts tests/api/auth/logout.test.ts
git commit -m "feat: proxy logout through Neon sign-out"
```

---

### Task 7: Update Middleware for `getSession(request)`

**Files:**
- Modify: `app/src/middleware.ts`
- Modify: `app/tests/middleware.test.ts`

- [ ] **Step 1: Update middleware call sites**

In `src/middleware.ts`, replace both `getSession(context.cookies)` with `getSession(context.request)`.

- [ ] **Step 2: Update middleware tests**

Add `request` to `createContext`:
```typescript
function createContext(pathname: string, search = "") {
  return {
    url: new URL(`http://localhost${pathname}${search}`),
    request: new Request(`http://localhost${pathname}${search}`),
    redirect: mockRedirect,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/middleware.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts tests/middleware.test.ts
git commit -m "refactor: middleware uses getSession(request)"
```

---

### Task 8: Login UI — Email Field

**Files:**
- Modify: `app/src/lib/client/alpine/forms/login.form.ts`
- Modify: `app/src/components/forms/LoginForm.astro`
- Modify: `app/src/lib/shared/constants/errors.constants.ts`
- Modify: `app/tests/lib/client/alpine/forms/login.form.test.ts`
- Modify: `app/tests/lib/shared/constants/errors.constants.test.ts`
- Modify: `app/tests/lib/shared/i18n/index.test.ts`

- [ ] **Step 1: Update error copy in `errors.constants.ts`**

```typescript
[MessageCode.INVALID_CREDENTIALS]: "Invalid email or password",
[MessageCode.MISSING_FIELDS]: "Email and password are required",
```

- [ ] **Step 2: Update `login.form.ts`**

Rename `username` → `email` in interface, state, and POST body:
```typescript
body: JSON.stringify({
  email: this.email,
  password: this.password,
}),
```

- [ ] **Step 3: Update `LoginForm.astro`**

```astro
<Input
  id="email"
  name="email"
  label="Email"
  type="email"
  autocomplete="email"
  required
  x-model="email"
/>
```

- [ ] **Step 4: Update login form tests**

- `component.username` → `component.email`
- Expected error: `"Invalid email or password"`
- POST body: `{ email, password }`

- [ ] **Step 5: Update error/i18n tests**

Change expected strings to email-oriented copy.

- [ ] **Step 6: Run tests**

Run: `npm test -- tests/lib/client/alpine/forms/login.form.test.ts tests/lib/shared/constants/errors.constants.test.ts tests/lib/shared/i18n/index.test.ts`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/client/alpine/forms/login.form.ts src/components/forms/LoginForm.astro src/lib/shared/constants/errors.constants.ts tests/lib/client/alpine/forms/login.form.test.ts tests/lib/shared/constants/errors.constants.test.ts tests/lib/shared/i18n/index.test.ts
git commit -m "feat: switch login form from username to email"
```

---

### Task 9: Update `bootstrap-env.ts`

**Files:**
- Modify: `app/src/lib/server/bootstrap-env.ts`

- [ ] **Step 1: Remove legacy early-return guard**

Replace the early-return block:
```typescript
if (
  process.env.SESSION_SECRET &&
  process.env.AUTH_USERNAME &&
  process.env.AUTH_PASSWORD
) {
  loaded = true;
  return;
}
```

With Neon auth check (or remove entirely):
```typescript
if (process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET) {
  loaded = true;
  return;
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/bootstrap-env.ts
git commit -m "chore: bootstrap env checks Neon auth vars"
```

---

### Task 10: Migrate `getSession` Call Sites (API Routes)

**Files:**
- Modify: `app/src/pages/api/games/index.ts`
- Modify: `app/src/pages/api/games/[slug]/config.ts`
- Modify: `app/src/pages/api/games/ten-up-one-down/session.ts`
- Modify: `app/src/pages/api/games/ten-up-one-down/session/round.ts`
- Modify: `app/src/pages/api/games/ten-up-one-down/session/round/last.ts`
- Modify: `app/src/pages/api/games/score-training/session.ts`
- Modify: `app/src/pages/api/games/score-training/session/round.ts`
- Modify: `app/src/pages/api/games/score-training/session/round/last.ts`
- Modify: `app/src/pages/api/games/score-training/session/complete.ts`
- Modify: `app/src/pages/api/games/singles-training/session.ts`
- Modify: `app/src/pages/api/games/singles-training/session/dart.ts`
- Modify: `app/src/pages/api/games/singles-training/session/dart/last.ts`
- Modify: `app/src/pages/api/games/singles-training/session/play-again.ts`
- Modify: `app/src/pages/api/settings/preferences.ts`

**Pattern for every file:**
1. Change handler destructure from `{ cookies }` to `{ request }` (keep `cookies` only if used elsewhere).
2. Replace `getSession(cookies)` → `getSession(request)`.
3. Replace `!session.username` / `!auth.username` guards with `!session.userId` / `!auth.userId`.
4. Replace all `session.username` / `auth.username` data-layer args with `.userId`.

Example (`src/pages/api/games/index.ts`):
```typescript
export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session.isLoggedIn || !session.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }
  // ...
};
```

- [ ] **Step 1: Apply pattern to all 14 API route files listed above**

- [ ] **Step 2: Run typecheck**

Run: `npm run check`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/
git commit -m "refactor: API routes use getSession(request) and userId"
```

---

### Task 11: Migrate `getSession` Call Sites (Astro Pages)

**Files:**
- Modify: `app/src/pages/index.astro`
- Modify: `app/src/pages/games/[game].astro`
- Modify: `app/src/pages/games/settings-[game].astro`

- [ ] **Step 1: Update `index.astro`**

```typescript
const session = await getSession(Astro.request);
const userId = session.userId;
// Only fetch quick-start games when logged in with userId
if (userId) {
  try {
    quickStartGames = await getQuickStartGames(userId, 2);
  } catch {
    quickStartGames = [];
  }
}
```

Remove `session.username ?? "default"` fallback.

- [ ] **Step 2: Update `[game].astro`**

- `getSession(Astro.request)`
- `session.username` → `session.userId` (6 references)

- [ ] **Step 3: Update `settings-[game].astro`**

- `getSession(Astro.request)`
- `auth.username` → `auth.userId` (6 references)

- [ ] **Step 4: Run typecheck**

Run: `npm run check`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/pages/games/
git commit -m "refactor: pages use getSession(request) and userId"
```

---

### Task 12: Update Game API Tests for `userId`

**Files:**
- Modify: `app/tests/api/games/index.test.ts`
- Modify: `app/tests/api/games/config.test.ts`
- Modify: `app/tests/api/games/ten-up-one-down/session.test.ts`
- Modify: `app/tests/api/games/ten-up-one-down/round.test.ts`
- Modify: `app/tests/api/games/ten-up-one-down/round-last.test.ts`
- Modify: `app/tests/api/games/score-training/session.test.ts`
- Modify: `app/tests/api/games/score-training/round.test.ts`
- Modify: `app/tests/api/games/score-training/round-last.test.ts`
- Modify: `app/tests/api/games/score-training/complete.test.ts`
- Modify: `app/tests/api/games/singles-training/session.test.ts`
- Modify: `app/tests/api/games/singles-training/dart.test.ts`
- Modify: `app/tests/api/games/singles-training/dart-last.test.ts`
- Modify: `app/tests/api/games/singles-training/play-again.test.ts`

**Pattern:**
```typescript
import { TEST_USER_ID } from "@lib/server/auth/neon";

const authState: { isLoggedIn: boolean; userId?: string } = { isLoggedIn: false };

// beforeEach:
authState.userId = TEST_USER_ID; // when logged in

// guards:
if (!auth.isLoggedIn || !auth.userId) → test renamed from "without username" to "without userId"

// saveGameConfig / createSession calls:
expect(mockCreate).toHaveBeenCalledWith(TEST_USER_ID, ...)
```

- [ ] **Step 1: Apply pattern to all 13 test files**

- [ ] **Step 2: Run game API tests**

Run: `npm test -- tests/api/games/`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/api/games/
git commit -m "test: update game API mocks to userId"
```

---

### Task 13: Update Page Assembly Tests

**Files:**
- Modify: `app/tests/pages/score-training-play-assembly.test.ts`
- Modify: `app/tests/pages/singles-training-play-assembly.test.ts`

- [ ] **Step 1: Update source assertions**

```typescript
expect(source).toContain("await getScoreTrainingSession(session.userId)");
expect(source).toContain("await getSinglesTrainingSession(session.userId)");
expect(source).toContain("await getSinglesTrainingSession(auth.userId)");
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/pages/`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/pages/
git commit -m "test: update page assembly assertions for userId"
```

---

### Task 14: Seed Script

**Files:**
- Create: `app/scripts/seed-neon-auth-user.ts`
- Modify: `app/package.json` (add script)

- [ ] **Step 1: Create seed script**

```typescript
import { bootstrapEnv } from "../src/lib/server/bootstrap-env";

bootstrapEnv();

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const email = process.argv[2] ?? process.env.SEED_AUTH_EMAIL;
const password = process.argv[3] ?? process.env.SEED_AUTH_PASSWORD;
const name = process.argv[4] ?? process.env.SEED_AUTH_NAME ?? "Dart Counter User";

if (!baseUrl || !email || !password) {
  console.error(
    "Usage: npx tsx scripts/seed-neon-auth-user.ts <email> <password> [name]\n" +
      "Or set NEON_AUTH_BASE_URL, SEED_AUTH_EMAIL, SEED_AUTH_PASSWORD"
  );
  process.exit(1);
}

const response = await fetch(`${baseUrl}/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, name }),
});

const body = await response.text();
if (!response.ok) {
  console.error(`Seed failed (${response.status}):`, body);
  process.exit(1);
}

console.log(`Seeded Neon Auth user: ${email}`);
```

- [ ] **Step 2: Add npm script to `package.json`**

```json
"seed:auth": "npx tsx scripts/seed-neon-auth-user.ts"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-neon-auth-user.ts package.json
git commit -m "feat: add Neon Auth user seed script"
```

---

### Task 15: Update `curl-verify-tuod.sh`

**Files:**
- Modify: `app/scripts/curl-verify-tuod.sh`

- [ ] **Step 1: Switch to email login**

```bash
EMAIL="${AUTH_EMAIL:-test@example.com}"
PASS="${AUTH_PASSWORD:-testpass}"
```

Login body:
```bash
-d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
```

- [ ] **Step 2: Commit**

```bash
git add scripts/curl-verify-tuod.sh
git commit -m "chore: curl verify script uses email login"
```

---

### Task 16: Update Documentation

**Files:**
- Rewrite: `docs/superpowers/context/login-feature-context.md`
- Modify: `docs/superpowers/context/logout-button-context.md`
- Modify: `docs/superpowers/specs/2026-06-13-login-design.md` (superseded banner)
- Modify: `docs/superpowers/specs/2026-06-17-blobs-to-database-design.md` (one line: `session.username` → `session.userId`)

- [ ] **Step 1: Rewrite login context** — document Neon Auth, email login, `userId`, proxy architecture; remove iron-session / env credentials.

- [ ] **Step 2: Update logout context** — Neon Auth cookies, proxy logout via `sign-out`.

- [ ] **Step 3: Add superseded banner to `2026-06-13-login-design.md`**

```markdown
> **Superseded:** See `docs/superpowers/specs/2026-06-18-neon-auth-migration-design.md` for current auth architecture.
```

- [ ] **Step 4: Update blobs spec schema table** — `session.username` → `session.userId`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/
git commit -m "docs: update auth context for Neon Auth migration"
```

---

### Task 17: Final Verification

- [ ] **Step 1: Grep cleanup checks (from spec §6.10)**

Run from `app/`:
```bash
grep -r iron-session . --include='*.ts' --include='*.astro' --include='*.mjs' || true
grep -r AUTH_USERNAME . || true
grep -r AUTH_PASSWORD . || true
grep -r SESSION_SECRET . || true
grep -r credentials.ts src/ tests/ || true
grep -r 'session\.username' src/ || true
grep -r 'auth\.username' src/ || true
```

Expected: zero hits in source (lockfile may still mention iron-session until reinstall completes).

- [ ] **Step 2: Full verification suite**

```bash
npm run check
npm test
npm run build
```

Expected: all PASS.

- [ ] **Step 3: Manual smoke test (local dev)**

1. Set `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` in `.env`
2. Run `npm run seed:auth -- your@email.com yourpassword`
3. `npm run dev` → login with seeded email → visit `/games` → logout
4. Confirm protected routes redirect to `/login` when logged out

- [ ] **Step 4: Netlify env checklist**

Add: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`  
Remove: `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET`

---

## Self-Review

| Spec requirement | Task |
|---|---|
| Neon Auth proxy architecture | Tasks 2–4 |
| `AppSession` + `getSession(request)` | Tasks 3, 7, 10–11 |
| Login/logout proxy + Set-Cookie | Tasks 5–6 |
| Remove iron-session + credentials | Tasks 1, 5 |
| Email login UI | Task 8 |
| `username` → `userId` (28 prod files) | Tasks 10–11 (+ settings/preferences in Task 10) |
| Test mock updates (22 files) | Tasks 12–13 + inline in Tasks 5–8 |
| Seed script | Task 14 |
| curl script | Task 15 |
| Docs updates | Task 16 |
| Verification checklist | Task 17 |
| Out of scope (blob migration, signup UI) | Not in plan |

**Note:** Spec lists `authApiHandler` from `@neondatabase/auth`; current package (`0.4.2-beta`) exports it from `@neondatabase/auth/next/server`. Handler uses standard `Request`/`Response` — safe for Astro. Do not import `createNeonAuth` session helpers (they use `next/headers`).

**Data migration caveat:** Blob data keyed by old `username` will not match new `userId` until a future migration (out of scope).
