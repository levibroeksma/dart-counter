# Settings Page & App Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each implementer subagent MUST also use superpowers:test-driven-development for code tasks and superpowers:verification-before-completion before claiming done.

**Goal:** Add authenticated app chrome (header + user menu) and a settings page where the user can set an optional display name persisted in Netlify Blobs.

**Architecture:** `AppLayout` wraps `BaseLayout` with `AppHeader`/`UserMenu`. Preferences live in a Netlify Blob (`user-preferences/default`) accessed via `GET/PUT /api/settings/preferences` Astro API routes. Display name validation is shared isomorphic code. Alpine factories handle dropdown and settings edit/save UX. Reusable `IconBtn` primitive composes profile, logout, save, and edit controls.

**Tech Stack:** Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript, `@netlify/blobs`, iron-session, Vitest, jsdom

**Branch:** `settings-page`  
**Spec:** `docs/superpowers/specs/2026-06-13-settings-page-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

**Verification order (every task after Task 1):**

```
npm run check  →  npm test  →  npm run build
```

**Local dev note:** Auth works with `npm run dev`. Blob read/write for preferences requires `netlify dev` for full local persistence. API/integration tests use mocks — no Netlify runtime required in CI.

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `src/icons/profile.svg` | User menu trigger icon |
| `src/icons/account-settings.svg` | Account settings link icon |
| `src/icons/save.svg` | Save display name icon |
| `src/icons/edit.svg` | Edit display name icon |
| `src/lib/shared/constants/errors.constants.ts` | Add `INVALID_DISPLAY_NAME`, `UNAUTHORIZED`, `SERVER_ERROR` |
| `src/lib/shared/api/types.ts` | Add `PreferencesSuccess`; extend `ApiSuccess` union |
| `src/lib/shared/validation/display-name.ts` | Trim, empty-clear, 2–20 char validation |
| `src/lib/server/data/preferences.ts` | Netlify Blob get/set for `UserPreferences` |
| `src/pages/api/settings/preferences.ts` | `GET` + `PUT` handlers with session gate |
| `src/components/ui/IconBtn.astro` | Reusable icon-only button/link primitive |
| `src/components/auth/LogoutBtn.astro` | Refactor to compose `IconBtn` |
| `src/lib/client/alpine/layout/user.menu.ts` | Dropdown open/close factory |
| `src/lib/client/alpine/settings/display-name.setting.ts` | View/edit/save factory |
| `src/lib/client/alpine/app.factory.ts` | Register new factories |
| `src/components/auth/UserMenu.astro` | Profile menu dropdown |
| `src/components/layout/AppHeader.astro` | Top banner with `UserMenu` |
| `src/layouts/AppLayout.astro` | `BaseLayout` + `AppHeader` + slot |
| `src/components/settings/DisplayNameSetting.astro` | Display name UI |
| `src/pages/settings.astro` | Settings page shell (SSR load prefs) |
| `src/pages/index.astro` | Switch to `AppLayout`; remove inline `LogoutBtn` |

**Unchanged:** `BaseLayout.astro`, `middleware.ts`, logout API, session helpers.

---

### Task 1: Settings Icon Assets

**Files:**
- Create: `app/src/icons/profile.svg`
- Create: `app/src/icons/account-settings.svg`
- Create: `app/src/icons/save.svg`
- Create: `app/src/icons/edit.svg`

- [ ] **Step 1: Create `src/icons/profile.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M0 0h24v24H0z" fill="none" />
  <path fill="currentColor" d="M12 19.2c-2.5 0-4.71-1.28-6-3.2c.03-2 4-3.1 6-3.1s5.97 1.1 6 3.1a7.23 7.23 0 0 1-6 3.2M12 5a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3m0-3A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10c0-5.53-4.5-10-10-10" />
</svg>
```

- [ ] **Step 2: Create `src/icons/account-settings.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M0 0h24v24H0z" fill="none" />
  <path fill="currentColor" d="M2 17v3h8v-1.89H3.9V17c0-.64 3.13-2.1 6.1-2.1c.96.01 1.91.14 2.83.38l1.52-1.52c-1.4-.47-2.85-.73-4.35-.76c-2.67 0-8 1.33-8 4m8-13C7.79 4 6 5.79 6 8s1.79 4 4 4s4-1.79 4-4s-1.79-4-4-4m0 6c-1.1 0-2-.89-2-2s.9-2 2-2s2 .9 2 2s-.89 2-2 2m11.7 3.35l-1 1l-2.05-2l1-1a.55.55 0 0 1 .77 0l1.28 1.28c.21.21.21.56 0 .77M12 18.94l6.06-6.06l2.05 2l-6 6.07H12z" />
</svg>
```

- [ ] **Step 3: Create `src/icons/save.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M0 0h24v24H0z" fill="none" />
  <path fill="currentColor" d="M4 19h6v2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v2.12l-2 2V7.83L15.17 5H4zm10-9V6H5v4zm6.42 2.3a.53.53 0 0 0-.38-.17c-.14 0-.28.06-.39.17l-1 1l2.05 2.05l1-1c.22-.21.22-.56 0-.77zM12 19.94V22h2.06l6.06-6.07l-2.05-2.05zM14 15c0-1.66-1.34-3-3-3s-3 1.34-3 3s1.34 3 3 3h.13L14 15.13z" />
</svg>
```

- [ ] **Step 4: Create `src/icons/edit.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M0 0h24v24H0z" fill="none" />
  <path fill="currentColor" d="m14.06 9l.94.94L5.92 19H5v-.92zm3.6-6c-.25 0-.51.1-.7.29l-1.83 1.83l3.75 3.75l1.83-1.83c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29m-3.6 3.19L3 17.25V21h3.75L17.81 9.94z" />
</svg>
```

- [ ] **Step 5: Verify**

Run: `npm run check`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/icons/profile.svg src/icons/account-settings.svg src/icons/save.svg src/icons/edit.svg
git commit -m "chore: add settings and user menu icon assets"
```

---

### Task 2: Message Codes & API Types

**Files:**
- Modify: `app/src/lib/shared/constants/errors.constants.ts`
- Modify: `app/src/lib/shared/api/types.ts`
- Modify: `app/tests/lib/shared/constants/errors.constants.test.ts`
- Modify: `app/tests/lib/shared/api/types.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/lib/shared/constants/errors.constants.test.ts` inside the `"defines all required message codes"` test:

```typescript
expect(MessageCode.INVALID_DISPLAY_NAME).toBe("INVALID_DISPLAY_NAME");
expect(MessageCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
expect(MessageCode.SERVER_ERROR).toBe("SERVER_ERROR");
```

Add to `"maps codes to expected English messages"`:

```typescript
expect(errorMessages[MessageCode.INVALID_DISPLAY_NAME]).toBe(
  "Display name must be 2–20 characters"
);
expect(errorMessages[MessageCode.UNAUTHORIZED]).toBe(
  "You must be logged in"
);
expect(errorMessages[MessageCode.SERVER_ERROR]).toBe(
  "Something went wrong. Please try again."
);
```

Replace `tests/lib/shared/api/types.test.ts` with:

```typescript
import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  ApiSuccess,
  ApiError,
  ApiResponse,
  PreferencesSuccess,
} from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("ApiResponse types", () => {
  it("ApiSuccess includes bare ok and preferences payload", () => {
    const bare: ApiSuccess = { ok: true };
    const prefs: PreferencesSuccess = { ok: true, displayName: "Alex" };
    expectTypeOf(bare.ok).toEqualTypeOf<true>();
    expectTypeOf(prefs.displayName).toEqualTypeOf<string | undefined>();
  });

  it("ApiError has ok: false and code", () => {
    const error: ApiError = { ok: false, code: MessageCode.MISSING_FIELDS };
    expectTypeOf(error.ok).toEqualTypeOf<false>();
    expectTypeOf(error.code).toEqualTypeOf<MessageCode>();
  });

  it("ApiResponse is a union of success and error", () => {
    const responses: ApiResponse[] = [
      { ok: true },
      { ok: true, displayName: "Alex" },
      { ok: false, code: MessageCode.INVALID_CREDENTIALS },
    ];
    expect(responses).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/shared/constants/errors.constants.test.ts tests/lib/shared/api/types.test.ts`  
Expected: FAIL — new codes/types missing

- [ ] **Step 3: Implement**

Replace `src/lib/shared/constants/errors.constants.ts`:

```typescript
export const MessageCode = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  MISSING_FIELDS: "MISSING_FIELDS",
  SERVER_CONFIG: "SERVER_CONFIG",
  NETWORK_ERROR: "NETWORK_ERROR",
  INVALID_DISPLAY_NAME: "INVALID_DISPLAY_NAME",
  UNAUTHORIZED: "UNAUTHORIZED",
  SERVER_ERROR: "SERVER_ERROR",
} as const;

export type MessageCode = (typeof MessageCode)[keyof typeof MessageCode];

export const errorMessages: Record<MessageCode, string> = {
  [MessageCode.INVALID_CREDENTIALS]: "Invalid username or password",
  [MessageCode.MISSING_FIELDS]: "Username and password are required",
  [MessageCode.SERVER_CONFIG]: "Server configuration error",
  [MessageCode.NETWORK_ERROR]: "Unable to connect. Please try again.",
  [MessageCode.INVALID_DISPLAY_NAME]: "Display name must be 2–20 characters",
  [MessageCode.UNAUTHORIZED]: "You must be logged in",
  [MessageCode.SERVER_ERROR]: "Something went wrong. Please try again.",
};
```

Replace `src/lib/shared/api/types.ts`:

```typescript
import type { MessageCode } from "@lib/shared/constants/errors.constants";

export type PreferencesSuccess = { ok: true; displayName?: string };
export type ApiSuccess = { ok: true } | PreferencesSuccess;
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/shared/constants/errors.constants.test.ts tests/lib/shared/api/types.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/constants/errors.constants.ts src/lib/shared/api/types.ts tests/lib/shared/constants/errors.constants.test.ts tests/lib/shared/api/types.test.ts
git commit -m "feat: add settings message codes and preferences API types"
```

---

### Task 3: Display Name Validator

**Files:**
- Create: `app/tests/lib/shared/validation/display-name.test.ts`
- Create: `app/src/lib/shared/validation/display-name.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/shared/validation/display-name.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateDisplayName } from "@lib/shared/validation/display-name";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("validateDisplayName", () => {
  it("accepts empty string after trim as clear", () => {
    expect(validateDisplayName("   ")).toEqual({ valid: true, value: "" });
  });

  it("accepts names between 2 and 20 characters", () => {
    expect(validateDisplayName("Al")).toEqual({ valid: true, value: "Al" });
    expect(validateDisplayName("  Alex  ")).toEqual({
      valid: true,
      value: "Alex",
    });
    expect(validateDisplayName("a".repeat(20))).toEqual({
      valid: true,
      value: "a".repeat(20),
    });
  });

  it("rejects names shorter than 2 characters", () => {
    expect(validateDisplayName("A")).toEqual({
      valid: false,
      code: MessageCode.INVALID_DISPLAY_NAME,
    });
  });

  it("rejects names longer than 20 characters", () => {
    expect(validateDisplayName("a".repeat(21))).toEqual({
      valid: false,
      code: MessageCode.INVALID_DISPLAY_NAME,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/validation/display-name.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `src/lib/shared/validation/display-name.ts`:

```typescript
import { MessageCode } from "@lib/shared/constants/errors.constants";

export type ValidateDisplayNameResult =
  | { valid: true; value: string }
  | { valid: false; code: typeof MessageCode.INVALID_DISPLAY_NAME };

/**
 * Validate and normalize a display name.
 * Empty after trim clears the preference; non-empty must be 2–20 characters.
 */
export function validateDisplayName(raw: string): ValidateDisplayNameResult {
  const value = raw.trim();

  if (value.length === 0) {
    return { valid: true, value: "" };
  }

  if (value.length < 2 || value.length > 20) {
    return { valid: false, code: MessageCode.INVALID_DISPLAY_NAME };
  }

  return { valid: true, value };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/validation/display-name.test.ts`  
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/validation/display-name.ts tests/lib/shared/validation/display-name.test.ts
git commit -m "feat: add shared display name validator"
```

---

### Task 4: Preferences Blob Store

**Files:**
- Modify: `app/package.json` (via npm install)
- Create: `app/tests/lib/server/data/preferences.test.ts`
- Create: `app/src/lib/server/data/preferences.ts`

- [ ] **Step 1: Install direct dependency**

Run: `npm install @netlify/blobs`  
Expected: `@netlify/blobs` added to `dependencies`

- [ ] **Step 2: Write the failing test**

Create `tests/lib/server/data/preferences.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSetJSON = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: mockGet,
    setJSON: mockSetJSON,
  })),
}));

import { getPreferences, setPreferences } from "@lib/server/data/preferences";

describe("preferences", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetJSON.mockReset();
  });

  it("returns empty object when blob is missing", async () => {
    mockGet.mockResolvedValue(null);
    await expect(getPreferences()).resolves.toEqual({});
  });

  it("returns stored preferences", async () => {
    mockGet.mockResolvedValue({ displayName: "Alex" });
    await expect(getPreferences()).resolves.toEqual({ displayName: "Alex" });
  });

  it("writes preferences to blob store", async () => {
    await setPreferences({ displayName: "Alex" });
    expect(mockSetJSON).toHaveBeenCalledWith("default", {
      displayName: "Alex",
    });
  });

  it("writes empty object when clearing display name", async () => {
    await setPreferences({});
    expect(mockSetJSON).toHaveBeenCalledWith("default", {});
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/lib/server/data/preferences.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 4: Implement**

Create `src/lib/server/data/preferences.ts`:

```typescript
import { getStore } from "@netlify/blobs";

export type UserPreferences = {
  displayName?: string;
};

const STORE_NAME = "user-preferences";
const KEY = "default";

/**
 * Read user preferences from Netlify Blobs.
 */
export async function getPreferences(): Promise<UserPreferences> {
  const store = getStore(STORE_NAME);
  const data = await store.get(KEY, { type: "json" });
  if (!data) {
    return {};
  }
  return data as UserPreferences;
}

/**
 * Persist user preferences to Netlify Blobs.
 */
export async function setPreferences(prefs: UserPreferences): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(KEY, prefs);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/lib/server/data/preferences.test.ts`  
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/server/data/preferences.ts tests/lib/server/data/preferences.test.ts
git commit -m "feat: add Netlify Blob preferences store"
```

---

### Task 5: Preferences API Routes

**Files:**
- Create: `app/tests/api/settings/preferences.test.ts`
- Create: `app/src/pages/api/settings/preferences.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/settings/preferences.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { GET, PUT } from "../../../src/pages/api/settings/preferences";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetPreferences = vi.fn();
const mockSetPreferences = vi.fn();

vi.mock("@lib/server/data/preferences", () => ({
  getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
  setPreferences: (...args: unknown[]) => mockSetPreferences(...args),
}));

const mockSession = { isLoggedIn: false };

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => mockSession),
}));

function createGetContext(): APIContext {
  return {
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

function createPutContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

describe("GET /api/settings/preferences", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockGetPreferences.mockReset();
  });

  it("returns 401 when not logged in", async () => {
    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns stored display name when logged in", async () => {
    mockSession.isLoggedIn = true;
    mockGetPreferences.mockResolvedValue({ displayName: "Alex" });

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, displayName: "Alex" });
  });

  it("returns 500 when blob read fails", async () => {
    mockSession.isLoggedIn = true;
    mockGetPreferences.mockRejectedValue(new Error("blob down"));

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_ERROR });
  });
});

describe("PUT /api/settings/preferences", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockSetPreferences.mockReset();
  });

  it("returns 401 when not logged in", async () => {
    const response = await PUT(createPutContext({ displayName: "Alex" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns 400 for invalid display name", async () => {
    mockSession.isLoggedIn = true;

    const response = await PUT(createPutContext({ displayName: "A" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.INVALID_DISPLAY_NAME });
    expect(mockSetPreferences).not.toHaveBeenCalled();
  });

  it("saves valid display name", async () => {
    mockSession.isLoggedIn = true;

    const response = await PUT(createPutContext({ displayName: "  Alex  " }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, displayName: "Alex" });
    expect(mockSetPreferences).toHaveBeenCalledWith({ displayName: "Alex" });
  });

  it("clears display name when empty", async () => {
    mockSession.isLoggedIn = true;

    const response = await PUT(createPutContext({ displayName: "   " }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockSetPreferences).toHaveBeenCalledWith({});
  });

  it("returns 500 when blob write fails", async () => {
    mockSession.isLoggedIn = true;
    mockSetPreferences.mockRejectedValue(new Error("blob down"));

    const response = await PUT(createPutContext({ displayName: "Alex" }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_ERROR });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/settings/preferences.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `src/pages/api/settings/preferences.ts`:

```typescript
import type { APIRoute } from "astro";
import type { ApiResponse, PreferencesSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { getSession } from "@lib/server/auth/session";
import {
  getPreferences,
  setPreferences,
  type UserPreferences,
} from "@lib/server/data/preferences";
import { validateDisplayName } from "@lib/shared/validation/display-name";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session.isLoggedIn) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    const prefs = await getPreferences();
    const body: PreferencesSuccess = { ok: true };
    if (prefs.displayName) {
      body.displayName = prefs.displayName;
    }
    return jsonResponse(body, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!session.isLoggedIn) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  let body: { displayName?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const validated = validateDisplayName(body.displayName ?? "");
  if (!validated.valid) {
    return jsonResponse({ ok: false, code: validated.code }, 400);
  }

  const prefs: UserPreferences = {};
  if (validated.value) {
    prefs.displayName = validated.value;
  }

  try {
    await setPreferences(prefs);
    const response: PreferencesSuccess = { ok: true };
    if (validated.value) {
      response.displayName = validated.value;
    }
    return jsonResponse(response, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/settings/preferences.test.ts`  
Expected: PASS (8 tests)

- [ ] **Step 5: Run full verification**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/settings/preferences.ts tests/api/settings/preferences.test.ts
git commit -m "feat: add GET/PUT preferences API routes"
```

---

### Task 6: IconBtn Primitive

**Files:**
- Create: `app/src/components/ui/IconBtn.astro`

- [ ] **Step 1: Create `IconBtn.astro`**

```astro
---
interface Props {
  ariaLabel: string;
  type?: "button" | "submit";
  href?: string;
  class?: string;
  [key: string]: unknown;
}

const {
  ariaLabel,
  type = "button",
  href,
  class: extraClass = "",
  ...rest
} = Astro.props;

const baseClass =
  "inline-flex items-center justify-center rounded p-2 text-xl leading-none text-sky-400 hover:text-sky-300 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none disabled:opacity-50 [&_svg]:block";
const className = `${baseClass} ${extraClass}`.trim();
---

{
  href ? (
    <a href={href} aria-label={ariaLabel} class={className} {...rest}>
      <slot />
    </a>
  ) : (
    <button type={type} aria-label={ariaLabel} class={className} {...rest}>
      <slot />
    </button>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/IconBtn.astro
git commit -m "feat: add reusable IconBtn UI primitive"
```

---

### Task 7: Refactor LogoutBtn to Use IconBtn

**Files:**
- Modify: `app/src/components/auth/LogoutBtn.astro`

- [ ] **Step 1: Refactor component**

Replace `src/components/auth/LogoutBtn.astro`:

```astro
---
import IconBtn from "@components/ui/IconBtn.astro";
import logoutIcon from "@icons/logout.svg?raw";
import { sanitizeRedirect } from "@lib/shared/utils/redirect";

interface Props {
  redirect?: string;
}

const { redirect = "/login" } = Astro.props;
const safeRedirect = sanitizeRedirect(redirect);
---

<div class="@container inline-flex flex-col items-stretch">
  <IconBtn
    ariaLabel="Logout"
    x-data="logoutBtn()"
    @click="logout"
    data-redirect={safeRedirect}
    :disabled="loading"
    :aria-busy="loading"
  >
    <span x-show="!loading" x-cloak set:html={logoutIcon} />
    <span
      x-show="loading"
      x-cloak
      class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent"
      aria-hidden="true"
    />
  </IconBtn>

  <p
    x-show="error"
    x-text="error"
    x-cloak
    class="text-error mt-1 text-xs"
    role="alert"
    aria-live="polite"
  />
</div>
```

- [ ] **Step 2: Verify existing logout tests still pass**

Run: `npm run check && npm test -- tests/lib/client/alpine/auth/logout.btn.test.ts && npm run build`  
Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/LogoutBtn.astro
git commit -m "refactor: compose LogoutBtn from IconBtn"
```

---

### Task 8: userMenu Alpine Factory

**Files:**
- Create: `app/tests/lib/client/alpine/layout/user.menu.test.ts`
- Create: `app/src/lib/client/alpine/layout/user.menu.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/client/alpine/layout/user.menu.test.ts`:

```typescript
// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { userMenu } from "@lib/client/alpine/layout/user.menu";

describe("userMenu", () => {
  it("starts closed", () => {
    const menu = userMenu();
    expect(menu.open).toBe(false);
  });

  it("toggles open state", () => {
    const menu = userMenu();
    menu.toggle();
    expect(menu.open).toBe(true);
    menu.toggle();
    expect(menu.open).toBe(false);
  });

  it("closes explicitly", () => {
    const menu = userMenu();
    menu.open = true;
    menu.close();
    expect(menu.open).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/client/alpine/layout/user.menu.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `src/lib/client/alpine/layout/user.menu.ts`:

```typescript
interface UserMenuState {
  open: boolean;
  toggle(): void;
  close(): void;
}

/**
 * Alpine data factory for the profile user menu dropdown.
 */
export function userMenu(): UserMenuState {
  return {
    open: false,

    toggle() {
      this.open = !this.open;
    },

    close() {
      this.open = false;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/client/alpine/layout/user.menu.test.ts`  
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/alpine/layout/user.menu.ts tests/lib/client/alpine/layout/user.menu.test.ts
git commit -m "feat: add userMenu Alpine factory"
```

---

### Task 9: displayNameSetting Alpine Factory

**Files:**
- Create: `app/tests/lib/client/alpine/settings/display-name.setting.test.ts`
- Create: `app/src/lib/client/alpine/settings/display-name.setting.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/client/alpine/settings/display-name.setting.test.ts`:

```typescript
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { displayNameSetting } from "@lib/client/alpine/settings/display-name.setting";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("displayNameSetting", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in empty mode when no initial name", () => {
    const component = displayNameSetting("");
    expect(component.mode).toBe("empty");
    expect(component.displayName).toBe("");
    expect(component.draft).toBe("");
  });

  it("starts in view mode when initial name is set", () => {
    const component = displayNameSetting("Alex");
    expect(component.mode).toBe("view");
    expect(component.displayName).toBe("Alex");
  });

  it("enters edit mode from view", () => {
    const component = displayNameSetting("Alex");
    component.startEdit();
    expect(component.mode).toBe("edit");
    expect(component.draft).toBe("Alex");
  });

  it("shows validation error for invalid draft without fetching", async () => {
    const component = displayNameSetting("");
    component.draft = "A";
    await component.save();
    expect(fetch).not.toHaveBeenCalled();
    expect(component.error).toBe("Display name must be 2–20 characters");
  });

  it("saves valid name and switches to view mode", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true, displayName: "Alex" }),
    } as Response);

    const component = displayNameSetting("");
    component.draft = "Alex";
    await component.save();

    expect(fetch).toHaveBeenCalledWith("/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Alex" }),
    });
    expect(component.displayName).toBe("Alex");
    expect(component.mode).toBe("view");
    expect(component.error).toBe("");
  });

  it("clears name and switches to empty mode", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    const component = displayNameSetting("Alex");
    component.startEdit();
    component.draft = "   ";
    await component.save();

    expect(fetch).toHaveBeenCalledWith("/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "   " }),
    });
    expect(component.displayName).toBe("");
    expect(component.mode).toBe("empty");
  });

  it("shows API error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: false, code: MessageCode.SERVER_ERROR }),
    } as Response);

    const component = displayNameSetting("");
    component.draft = "Alex";
    await component.save();

    expect(component.error).toBe("Something went wrong. Please try again.");
    expect(component.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/client/alpine/settings/display-name.setting.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `src/lib/client/alpine/settings/display-name.setting.ts`:

```typescript
import type { ApiResponse, PreferencesSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";
import { validateDisplayName } from "@lib/shared/validation/display-name";

export type DisplayNameMode = "empty" | "view" | "edit";

interface DisplayNameSettingState {
  displayName: string;
  draft: string;
  mode: DisplayNameMode;
  loading: boolean;
  error: string;
  startEdit(): void;
  save(): Promise<void>;
}

/**
 * Alpine data factory for the display name settings control.
 */
export function displayNameSetting(
  initialDisplayName = ""
): DisplayNameSettingState {
  const trimmed = initialDisplayName.trim();
  const hasName = trimmed.length > 0;

  return {
    displayName: hasName ? trimmed : "",
    draft: hasName ? trimmed : "",
    mode: hasName ? "view" : "empty",
    loading: false,
    error: "",

    startEdit() {
      this.draft = this.displayName;
      this.mode = "edit";
      this.error = "";
    },

    async save() {
      this.loading = true;
      this.error = "";

      const validated = validateDisplayName(this.draft);
      if (!validated.valid) {
        this.error = t(validated.code);
        this.loading = false;
        return;
      }

      try {
        const response = await fetch("/api/settings/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: this.draft }),
        });

        const data: ApiResponse = await response.json();

        if (!data.ok) {
          this.error = data.code ? t(data.code) : t(MessageCode.NETWORK_ERROR);
          return;
        }

        const success = data as PreferencesSuccess;
        this.displayName = success.displayName ?? "";
        this.draft = this.displayName;
        this.mode = this.displayName ? "view" : "empty";
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/client/alpine/settings/display-name.setting.test.ts`  
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/alpine/settings/display-name.setting.ts tests/lib/client/alpine/settings/display-name.setting.test.ts
git commit -m "feat: add displayNameSetting Alpine factory"
```

---

### Task 10: Register Alpine Factories

**Files:**
- Modify: `app/src/lib/client/alpine/app.factory.ts`

- [ ] **Step 1: Register factories**

Replace `src/lib/client/alpine/app.factory.ts`:

```typescript
import type { Alpine } from "alpinejs";
import { loginForm } from "@lib/client/alpine/forms/login.form";
import { logoutBtn } from "@lib/client/alpine/auth/logout.btn";
import { userMenu } from "@lib/client/alpine/layout/user.menu";
import { displayNameSetting } from "@lib/client/alpine/settings/display-name.setting";

export default (Alpine: Alpine) => {
  Alpine.data("loginForm", loginForm);
  Alpine.data("logoutBtn", logoutBtn);
  Alpine.data("userMenu", userMenu);
  Alpine.data("displayNameSetting", displayNameSetting);
};
```

- [ ] **Step 2: Verify**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/client/alpine/app.factory.ts
git commit -m "feat: register userMenu and displayNameSetting Alpine factories"
```

---

### Task 11: UserMenu & AppHeader Components

**Files:**
- Create: `app/src/components/auth/UserMenu.astro`
- Create: `app/src/components/layout/AppHeader.astro`

- [ ] **Step 1: Create `UserMenu.astro`**

```astro
---
import IconBtn from "@components/ui/IconBtn.astro";
import LogoutBtn from "@components/auth/LogoutBtn.astro";
import profileIcon from "@icons/profile.svg?raw";
import accountSettingsIcon from "@icons/account-settings.svg?raw";
---

<div
  class="@container relative inline-flex flex-col items-end"
  x-data="userMenu()"
  @keydown.escape.window="close()"
  @click.outside="close()"
>
  <IconBtn
    ariaLabel="User menu"
    type="button"
    @click="toggle()"
    :aria-expanded="open"
    aria-haspopup="menu"
  >
    <span set:html={profileIcon} />
  </IconBtn>

  <div
    x-show="open"
    x-cloak
    role="menu"
    class="absolute top-full right-0 z-10 mt-2 min-w-48 rounded-lg border border-border bg-surface-card py-1 shadow-lg"
  >
    <a
      href="/settings"
      role="menuitem"
      class="text-text-primary hover:bg-surface-input flex items-center gap-2 px-3 py-2 text-sm"
    >
      <span
        class="inline-block text-xl leading-none [&_svg]:block"
        set:html={accountSettingsIcon}
        aria-hidden="true"
      />
      Account settings
    </a>

    <div role="none" class="px-1 py-1">
      <LogoutBtn />
    </div>
  </div>
</div>
```

- [ ] **Step 2: Create `AppHeader.astro`**

```astro
---
import UserMenu from "@components/auth/UserMenu.astro";
---

<header role="banner" class="flex justify-end p-4">
  <UserMenu />
</header>
```

- [ ] **Step 3: Verify build**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/UserMenu.astro src/components/layout/AppHeader.astro
git commit -m "feat: add UserMenu dropdown and AppHeader layout component"
```

---

### Task 12: AppLayout & Home Page Integration

**Files:**
- Create: `app/src/layouts/AppLayout.astro`
- Modify: `app/src/pages/index.astro`

- [ ] **Step 1: Create `AppLayout.astro`**

```astro
---
import BaseLayout from "@layouts/BaseLayout.astro";
import AppHeader from "@components/layout/AppHeader.astro";
---

<BaseLayout>
  <AppHeader />
  <slot />
</BaseLayout>
```

- [ ] **Step 2: Update `index.astro`**

Replace `src/pages/index.astro`:

```astro
---
import AppLayout from "@layouts/AppLayout.astro";
---

<AppLayout>
  <main class="p-4">
    <h1>Home</h1>
  </main>
</AppLayout>
```

- [ ] **Step 3: Verify build**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/layouts/AppLayout.astro src/pages/index.astro
git commit -m "feat: add AppLayout and migrate home page to header chrome"
```

---

### Task 13: DisplayNameSetting Component & Settings Page

**Files:**
- Create: `app/src/components/settings/DisplayNameSetting.astro`
- Create: `app/src/pages/settings.astro`

- [ ] **Step 1: Create `DisplayNameSetting.astro`**

```astro
---
import Input from "@components/ui/Input.astro";
import IconBtn from "@components/ui/IconBtn.astro";
import saveIcon from "@icons/save.svg?raw";
import editIcon from "@icons/edit.svg?raw";

interface Props {
  initialDisplayName?: string;
}

const { initialDisplayName = "" } = Astro.props;
const xDataExpression = `displayNameSetting(${JSON.stringify(initialDisplayName)})`;
---

<section
  class="@container max-w-md space-y-4"
  x-data={xDataExpression}
  aria-labelledby="display-name-heading"
>
  <h2 id="display-name-heading" class="text-text-primary font-semibold">
    Display name
  </h2>

  <div x-show="mode === 'view'" x-cloak class="flex items-center gap-2">
    <p class="text-text-primary flex-1" x-text="displayName"></p>
    <IconBtn ariaLabel="Edit display name" type="button" @click="startEdit()">
      <span set:html={editIcon} />
    </IconBtn>
  </div>

  <div
    x-show="mode === 'empty' || mode === 'edit'"
    x-cloak
    class="flex items-end gap-2"
  >
    <div class="flex-1">
      <Input
        id="display-name"
        name="displayName"
        label="Display name"
        type="text"
        autocomplete="nickname"
        x-model="draft"
      />
    </div>
    <IconBtn
      ariaLabel="Save display name"
      type="button"
      @click="save()"
      :disabled="loading"
      :aria-busy="loading"
    >
      <span x-show="!loading" x-cloak set:html={saveIcon} />
      <span
        x-show="loading"
        x-cloak
        class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent"
        aria-hidden="true"
      />
    </IconBtn>
  </div>

  <p
    x-show="error"
    x-text="error"
    x-cloak
    class="text-error text-sm"
    role="alert"
    aria-live="polite"
  />
</section>
```

- [ ] **Step 2: Create `settings.astro`**

```astro
---
import AppLayout from "@layouts/AppLayout.astro";
import DisplayNameSetting from "@components/settings/DisplayNameSetting.astro";
import { getPreferences } from "@lib/server/data/preferences";

let initialDisplayName = "";

try {
  const prefs = await getPreferences();
  initialDisplayName = prefs.displayName ?? "";
} catch {
  initialDisplayName = "";
}
---

<AppLayout>
  <main class="p-4">
    <h1 class="text-text-primary mb-6 text-2xl font-semibold">Settings</h1>
    <DisplayNameSetting initialDisplayName={initialDisplayName} />
  </main>
</AppLayout>
```

- [ ] **Step 3: Verify build**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/DisplayNameSetting.astro src/pages/settings.astro
git commit -m "feat: add settings page with display name preference"
```

---

### Task 14: Final Verification & Manual Smoke Tests

**Files:** none (verification only)

- [ ] **Step 1: Run full automated verification**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 2: Manual smoke tests with `netlify dev`**

Run from `app/`: `npx netlify dev`

1. Log in at `/login`
2. `/` shows profile icon top-right; no standalone logout on page body
3. Open menu → "Account settings" navigates to `/settings`
4. Logout from menu → `/login`; revisit `/` redirects to login
5. `/settings` with no saved name → empty input + save icon
6. Save `"Al"` (2 chars) → view mode with read-only text + edit icon
7. Edit → change → save → updated view
8. Edit → clear input → save → empty input state
9. Save `"A"` or 21-char string → inline validation error
10. DevTools: unauthenticated `fetch('/api/settings/preferences')` → 401

- [ ] **Step 3: Commit if any fixups were needed**

Only if smoke tests required changes. Otherwise skip.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| AppLayout wraps BaseLayout + AppHeader + slot | Task 12 |
| Login stays on BaseLayout only | Task 12 (login unchanged) |
| IconBtn primitive | Task 6 |
| Profile dropdown with Account settings + logout | Task 11 |
| LogoutBtn refactored to IconBtn | Task 7 |
| Display name empty/view/edit UX | Task 9, Task 13 |
| Validation 2–20 chars, empty clears | Task 3, Task 5, Task 9 |
| Netlify Blob storage | Task 4 |
| GET/PUT `/api/settings/preferences` | Task 5 |
| Session gate on API | Task 5 |
| New message codes | Task 2 |
| Alpine factories registered | Task 8, Task 9, Task 10 |
| Icons in `src/icons/` | Task 1 |
| Remove inline LogoutBtn from home | Task 12 |
| Vitest TDD coverage | Tasks 3–5, 8–9 |
| `npm run check` → `npm test` → `npm run build` | All tasks |
| `netlify dev` for local Blob persistence | Task 14 |

---

## Manual Test Plan (post-implementation)

- [ ] Logged-in `/` shows header profile icon; no page-body logout button
- [ ] Profile menu opens/closes; Escape and outside click close it
- [ ] Account settings link opens `/settings`
- [ ] Logout from menu clears session
- [ ] Display name save/load round-trips via Blob (use `netlify dev`)
- [ ] Validation errors show inline for too-short/too-long names
- [ ] Keyboard: Tab reaches icon buttons; focus rings visible
