# Logout Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each implementer subagent MUST also use superpowers:test-driven-development for code tasks and superpowers:verification-before-completion before claiming done.

**Goal:** Add a reusable icon-only logout button that POSTs to the existing logout API, destroys the session, and redirects to `/login`.

**Architecture:** Alpine `logoutBtn()` factory mirrors `loginForm()` — `fetch` POST to `/api/auth/logout`, typed `ApiResponse`, redirect on success, inline `t(code)` error on failure. `LogoutBtn.astro` composes the icon SVG and loading spinner. `BaseLayout` mounts the button in a top-right header on all pages except `/login`.

**Tech Stack:** Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript, Vitest, jsdom

**Branch:** `login-interface` (or `logout-btn`)  
**Context:** `docs/superpowers/context/logout-button-context.md`  
**Working directory:** `app/` (all commands run from here unless noted)

**Verification order (every task after Task 1):**
```
npm run check  →  npm test  →  npm run build
```

---

## Design Decisions (resolved from open questions)

| Topic | Decision | Rationale |
|---|---|---|
| Component placement | `components/auth/LogoutBtn.astro` | Auth-specific feature control, not a generic UI primitive |
| Post-logout redirect | Default `/login`; optional `redirect` prop sanitized via `sanitizeRedirect()` | Matches login redirect pattern; middleware sends unauthenticated users to `/login` anyway |
| Error handling | Inline text below button, `role="alert"` + `aria-live="polite"` | Same pattern as `LoginForm.astro` |
| Loading UX | Spinner replaces icon while loading | Same swap pattern as `PrimaryBtn.astro`, adapted for icon-only |
| First integration | `BaseLayout.astro` header, hidden on `/login` | One mount point covers all authenticated pages; no per-page wiring |

**Out of scope:** Server/API changes (logout API already exists), generic `IconBtn` primitive, i18n for `aria-label` (hardcoded `"Logout"` like login button label).

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `src/icons/logout.svg` | Logout icon asset (`currentColor`, scales with `1em`) |
| `tsconfig.json` | Add `@icons/*` path alias |
| `vitest.config.ts` | Add `@icons` resolve alias |
| `src/lib/client/alpine/auth/logout.btn.ts` | Alpine `logoutBtn()` factory |
| `src/lib/client/alpine/app.factory.ts` | Register `logoutBtn` |
| `src/components/auth/LogoutBtn.astro` | Icon button + Alpine bindings + error display |
| `src/layouts/BaseLayout.astro` | Top-right header mount point |
| `tests/lib/client/alpine/auth/logout.btn.test.ts` | Factory unit tests |

**No changes expected:** `src/pages/api/auth/logout.ts`, middleware, session helpers.

---

### Task 1: Logout Icon Asset & Path Alias

**Files:**
- Create: `app/src/icons/logout.svg`
- Modify: `app/tsconfig.json`
- Modify: `app/vitest.config.ts`

- [ ] **Step 1: Create `src/icons/logout.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M0 0h24v24H0z" fill="none" />
  <path fill="currentColor" d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h7v2H5v14h7v2zm11-4l-1.375-1.45l2.55-2.55H9v-2h8.175l-2.55-2.55L16 7l5 5z" />
</svg>
```

- [ ] **Step 2: Add `@icons` alias to `tsconfig.json`**

Add to `compilerOptions.paths`:

```json
"@icons/*": ["./src/icons/*"]
```

Full `paths` block:

```json
"paths": {
  "@styles/*": ["./src/styles/*"],
  "@layouts/*": ["./src/layouts/*"],
  "@lib/*": ["./src/lib/*"],
  "@components/*": ["./src/components/*"],
  "@icons/*": ["./src/icons/*"]
}
```

- [ ] **Step 3: Add `@icons` alias to `vitest.config.ts`**

Add to `resolve.alias`:

```typescript
"@icons": path.resolve(__dirname, "./src/icons"),
```

- [ ] **Step 4: Verify aliases**

Run: `npm run check`  
Expected: PASS (no type errors)

- [ ] **Step 5: Commit**

```bash
git add src/icons/logout.svg tsconfig.json vitest.config.ts
git commit -m "chore: add logout icon asset and @icons path alias"
```

---

### Task 2: logoutBtn Alpine Factory

**Files:**
- Create: `app/tests/lib/client/alpine/auth/logout.btn.test.ts`
- Create: `app/src/lib/client/alpine/auth/logout.btn.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/client/alpine/auth/logout.btn.test.ts`:

```typescript
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logoutBtn } from "@lib/client/alpine/auth/logout.btn";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("logoutBtn", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createComponent(redirect = "/login") {
    const button = document.createElement("button");
    button.dataset.redirect = redirect;
    document.body.appendChild(button);

    const component = logoutBtn() as ReturnType<typeof logoutBtn> & {
      $el: HTMLButtonElement;
      logout: () => Promise<void>;
    };
    component.$el = button;
    return component;
  }

  it("starts with loading false and no error", () => {
    const component = createComponent();
    expect(component.loading).toBe(false);
    expect(component.error).toBe("");
  });

  it("POSTs to logout API", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    const component = createComponent();
    await component.logout();

    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });

  it("redirects to /login on successful logout", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    const component = createComponent();
    await component.logout();

    expect(window.location.href).toBe("/login");
  });

  it("redirects to custom path from data-redirect", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    const component = createComponent("/goodbye");
    await component.logout();

    expect(window.location.href).toBe("/goodbye");
  });

  it("displays network error on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network"));

    const component = createComponent();
    await component.logout();

    expect(component.error).toBe("Unable to connect. Please try again.");
    expect(component.loading).toBe(false);
  });

  it("displays translated error when API returns ok: false", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: false, code: MessageCode.SERVER_CONFIG }),
    } as Response);

    const component = createComponent();
    await component.logout();

    expect(component.error).toBe("Server configuration error");
    expect(component.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/client/alpine/auth/logout.btn.test.ts`  
Expected: FAIL with module not found (`logout.btn`)

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/client/alpine/auth/logout.btn.ts`:

```typescript
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";

interface LogoutBtnState {
  loading: boolean;
  error: string;
  $el: HTMLButtonElement;
  logout(): Promise<void>;
}

/**
 * Alpine data factory for the logout button.
 */
export function logoutBtn(): LogoutBtnState {
  return {
    loading: false,
    error: "",

    $el: undefined as unknown as HTMLButtonElement,

    async logout(this: LogoutBtnState) {
      this.loading = true;
      this.error = "";

      const redirect = this.$el.dataset.redirect || "/login";

      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
        });

        const data: ApiResponse = await response.json();

        if (data.ok) {
          window.location.href = redirect;
          return;
        }

        this.error = data.code ? t(data.code) : t(MessageCode.NETWORK_ERROR);
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

Run: `npm test -- tests/lib/client/alpine/auth/logout.btn.test.ts`  
Expected: PASS (6 tests)

- [ ] **Step 5: Run full verification**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/client/alpine/auth/logout.btn.ts tests/lib/client/alpine/auth/logout.btn.test.ts
git commit -m "feat: add logoutBtn Alpine factory with fetch and redirect"
```

---

### Task 3: Register Alpine Factory

**Files:**
- Modify: `app/src/lib/client/alpine/app.factory.ts`

- [ ] **Step 1: Register `logoutBtn`**

Replace contents of `app.factory.ts`:

```typescript
import type { Alpine } from "alpinejs";
import { loginForm } from "@lib/client/alpine/forms/login.form";
import { logoutBtn } from "@lib/client/alpine/auth/logout.btn";

export default (Alpine: Alpine) => {
  Alpine.data("loginForm", loginForm);
  Alpine.data("logoutBtn", logoutBtn);
};
```

- [ ] **Step 2: Verify**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/client/alpine/app.factory.ts
git commit -m "feat: register logoutBtn in Alpine entrypoint"
```

---

### Task 4: LogoutBtn Component

**Files:**
- Create: `app/src/components/auth/LogoutBtn.astro`

- [ ] **Step 1: Create `LogoutBtn.astro`**

```astro
---
import logoutIcon from "@icons/logout.svg?raw";
import { sanitizeRedirect } from "@lib/shared/utils/redirect";

interface Props {
  redirect?: string;
}

const { redirect = "/login" } = Astro.props;
const safeRedirect = sanitizeRedirect(redirect);
---

<div class="@container inline-flex flex-col items-end">
  <button
    type="button"
    x-data="logoutBtn()"
    @click="logout"
    data-redirect={safeRedirect}
    :disabled="loading"
    :aria-busy="loading"
    aria-label="Logout"
    class="rounded p-2 text-sky-400 hover:text-sky-300 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none disabled:opacity-50"
  >
    <span
      x-show="!loading"
      x-cloak
      class="inline-block text-xl leading-none [&_svg]:block"
      set:html={logoutIcon}
    />
    <span
      x-show="loading"
      x-cloak
      class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent"
      aria-hidden="true"
    ></span>
  </button>

  <p
    x-show="error"
    x-text="error"
    x-cloak
    class="text-error mt-1 text-xs"
    role="alert"
    aria-live="polite"
  ></p>
</div>
```

- [ ] **Step 2: Verify build includes component**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/LogoutBtn.astro
git commit -m "feat: add LogoutBtn icon button component"
```

---

### Task 5: Integrate into BaseLayout

**Files:**
- Modify: `app/src/layouts/BaseLayout.astro`

- [ ] **Step 1: Add header with LogoutBtn**

Replace `BaseLayout.astro` with:

```astro
---
import "@styles/global.css";
import LogoutBtn from "@components/auth/LogoutBtn.astro";

const url = Astro.url;
const showLogout = url.pathname !== "/login";

const title =
  url.pathname === "/"
    ? "Dart Counter"
    : `${url.pathname.slice(1)} - Dart Counter`;
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width" />
    <meta name="generator" content={Astro.generator} />
    <title>{title}</title>
  </head>
  <body>
    {showLogout && (
      <header class="flex justify-end p-4">
        <LogoutBtn />
      </header>
    )}
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`

1. Visit `http://localhost:4321/` — logout icon visible top-right (sky color)
2. Click logout — redirects to `/login`, session cleared (revisiting `/` redirects back to login)
3. Log in — returns to `/`, logout icon visible again
4. Visit `/login` while logged out — no logout icon in header

- [ ] **Step 3: Full verification**

Run: `npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: mount logout button in BaseLayout header"
```

---

## Spec Coverage Checklist

| Requirement (from context) | Task |
|---|---|
| Reusable logout button component | Task 4 (`redirect` prop) |
| POST → session destroy → redirect | Task 2 (factory), existing API |
| Icon-only button with `aria-label` | Task 4 |
| Custom SVG at `src/icons/logout.svg` | Task 1 |
| `@icons/*` path alias | Task 1 |
| Sky palette colors | Task 4 |
| Spinner replaces icon while loading | Task 4 |
| Inline error on network failure | Task 2, Task 4 |
| Alpine factory + registry pattern | Task 2, Task 3 |
| No `<script>` in `.astro` | Task 4 |
| `@container` on component root | Task 4 |
| First integration in layout | Task 5 |
| Vitest TDD for client logic | Task 2 |
| `npm run check` → `npm test` → `npm run build` | All tasks |

---

## Manual Test Plan (post-implementation)

- [ ] Logged-in user sees sky-colored logout icon top-right on `/`
- [ ] Clicking logout POSTs to `/api/auth/logout` and lands on `/login`
- [ ] After logout, navigating to `/` redirects to `/login?redirect=%2F`
- [ ] Login page does not show logout button
- [ ] Network failure (devtools offline) shows inline error below button
- [ ] Button shows spinner and is disabled while request is in flight
- [ ] Keyboard: Tab focuses button, Enter/Space triggers logout, focus ring visible
