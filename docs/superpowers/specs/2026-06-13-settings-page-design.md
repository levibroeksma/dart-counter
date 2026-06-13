# Settings Page & App Header — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-13  
**Branch:** `settings-page` (anticipated)  
**Scope:** App header with user menu, settings page (display name), preferences API, Netlify Blobs storage

---

## 1. Overview

Extend Dart Counter with authenticated app chrome (header + user menu) and a minimal settings page. User preferences persist in Netlify Blobs via Astro API routes (Netlify Functions on deploy). First preference: optional display name (2–20 characters).

| Item | Value |
|---|---|
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Hosting | Netlify (SSR Functions + Blobs) |
| Session | `iron-session` (auth only — unchanged) |
| Preferences | Netlify Blobs store `user-preferences`, key `default` |
| Dev | `netlify dev` for Blob persistence; `astro dev` for auth-only flows |

---

## 2. Architecture

```
Browser                         Astro (Netlify Function)              Netlify Blobs
───────                         ────────────────────────              ─────────────
Protected page (AppLayout)
  └── AppHeader / UserMenu
        ├── link → /settings
        └── LogoutBtn → POST /api/auth/logout

/settings (SSR)
  └── DisplayNameSetting
        ├── GET (SSR) ← getPreferences()
        └── save → PUT /api/settings/preferences
                              │
                              ├── session check
                              ├── validate display name
                              └── read/write blob ──────────► user-preferences/default
```

**No database.** Preferences API routes are Astro endpoints (`app/src/pages/api/`) — same pattern as `/api/auth/login` and `/api/auth/logout`. On Netlify they run as serverless functions. Storage is `@netlify/blobs` object storage, not a relational DB.

---

## 3. Layouts

### `BaseLayout.astro` (unchanged)

HTML document shell: `<html>`, `<head>`, global styles, `<body>`, single `<slot />`.

### `AppLayout.astro` (new)

Wraps `BaseLayout` and injects app chrome. **All non-login pages use `AppLayout`.**

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

`BaseLayout` derives `<title>` from `Astro.url.pathname` (existing behavior). No title prop required.

### Page usage

| Route | Layout | Notes |
|---|---|---|
| `/login` | `BaseLayout` | Centered login card; no header |
| `/` | `AppLayout` | Replace inline `LogoutBtn` with header menu |
| `/settings` | `AppLayout` | Settings content in page `<main>` |

---

## 4. File Structure

```
app/
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro          # unchanged
│   │   └── AppLayout.astro           # BaseLayout + AppHeader + slot
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Input.astro           # existing
│   │   │   ├── PrimaryBtn.astro      # existing
│   │   │   └── IconBtn.astro         # new — reusable icon-only button
│   │   ├── layout/
│   │   │   └── AppHeader.astro       # top bar; contains UserMenu
│   │   ├── auth/
│   │   │   ├── UserMenu.astro        # profile trigger + dropdown
│   │   │   └── LogoutBtn.astro       # refactor to compose IconBtn
│   │   └── settings/
│   │       └── DisplayNameSetting.astro
│   ├── icons/
│   │   ├── logout.svg                # existing
│   │   ├── profile.svg               # user menu trigger
│   │   ├── account-settings.svg      # dropdown link
│   │   ├── save.svg                  # save display name
│   │   └── edit.svg                  # enter edit mode
│   ├── lib/
│   │   ├── client/alpine/
│   │   │   ├── app.factory.ts        # register new factories
│   │   │   ├── auth/logout.btn.ts    # existing logic
│   │   │   ├── layout/user.menu.ts   # dropdown toggle
│   │   │   └── settings/display-name.setting.ts
│   │   ├── server/data/
│   │   │   └── preferences.ts        # Blob get/set
│   │   └── shared/
│   │       ├── api/types.ts          # extend response types
│   │       ├── constants/errors.constants.ts
│   │       ├── i18n/index.ts
│   │       └── validation/display-name.ts
│   └── pages/
│       ├── index.astro               # switch to AppLayout
│       ├── settings.astro            # new
│       └── api/settings/
│           └── preferences.ts        # GET + PUT
└── tests/
    ├── lib/shared/validation/display-name.test.ts
    ├── lib/server/data/preferences.test.ts
    ├── lib/client/alpine/layout/user.menu.test.ts
    ├── lib/client/alpine/settings/display-name.setting.test.ts
    └── api/settings/preferences.test.ts
```

---

## 5. UI Design

### Theme & styling conventions

Follow login/logout conventions:

- Semantic tokens from `global.css` for surfaces, text, borders, errors
- Icon buttons use Tailwind `sky-*` palette (consistent with existing `LogoutBtn`)
- `@container` on component roots; `@sm:` variants inside components
- Pages use viewport utilities only
- No `<script>` in `.astro`; Alpine factories in `lib/client/alpine/`

### `IconBtn.astro`

Reusable icon-only button primitive.

| Prop | Purpose |
|---|---|
| `ariaLabel` | Required accessible name |
| `type` | `button` (default) or `submit` |
| `href` | If set, renders `<a>` instead of `<button>` |
| default slot | Icon HTML (`set:html` from caller) |

Supports Alpine bindings via standard attributes (`:disabled`, `:aria-busy`, `@click`). Loading state: optional spinner replaces icon slot (same pattern as `LogoutBtn` / `PrimaryBtn`).

Base classes: `rounded p-2 text-sky-400 hover:text-sky-300 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none disabled:opacity-50`.

### `AppHeader.astro`

Semantic `<header role="banner">`. Full-width top bar with flex row, content right-aligned. Contains `UserMenu` only (v1).

### `UserMenu.astro`

Alpine factory `userMenu()`:

| Element | Behavior |
|---|---|
| Profile `IconBtn` | Toggles dropdown; `aria-expanded`, `aria-haspopup="menu"`, `aria-label="User menu"` |
| Dropdown panel | `bg-surface-card border border-border rounded-lg shadow` |
| Account settings row | `<a href="/settings">` with account-settings icon + text "Account settings" |
| Logout row | `LogoutBtn` (refactored to use `IconBtn`) |

Close dropdown on: outside click, Escape key. v1 does not require focus trap or arrow-key navigation.

Icons: import via `@icons/*.svg?raw`, `aria-hidden="true"`, `fill="currentColor"`.

### `LogoutBtn.astro` (refactor)

Compose `IconBtn` instead of inline button markup. Preserve existing Alpine `logoutBtn()` behavior, loading spinner, inline error, and `data-redirect` prop.

### `DisplayNameSetting.astro`

Alpine factory `displayNameSetting(initialDisplayName?)`. Server passes initial value from SSR blob read.

| State | UI |
|---|---|
| Empty (no saved name) | Label "Display name", empty `Input`, save `IconBtn` |
| View (name saved) | Read-only text showing name + edit `IconBtn` |
| Edit (after edit click) | `Input` pre-filled + save `IconBtn` |

Layout: label above; input and action button in one row (`flex items-end gap-2`). On successful save, return to view mode (or empty state if cleared). v1 has no explicit cancel button.

Input reuses `components/ui/Input.astro` with label `"Display name"`.

### Settings page shell (`settings.astro`)

```astro
<AppLayout>
  <main class="p-4">
    <h1>Settings</h1>
    <DisplayNameSetting initialDisplayName={...} />
  </main>
</AppLayout>
```

Exact page layout/spacing follows existing page patterns; content area below header.

---

## 6. Data Model & Validation

### Preferences shape

```typescript
type UserPreferences = {
  displayName?: string;
};
```

Blob store: `user-preferences`. Key: `default` (single-user app).

### Display name rules (`lib/shared/validation/display-name.ts`)

Shared isomorphic validator used by API and client:

1. Trim whitespace
2. Empty string after trim → valid (clears `displayName` from preferences)
3. Non-empty → length 2–20 characters inclusive
4. No uniqueness constraint
5. No character-set restriction beyond trim (any printable string)

Returns `{ valid: true, value: string }` or `{ valid: false, code: MessageCode.INVALID_DISPLAY_NAME }`.

---

## 7. Server Logic

### `lib/server/data/preferences.ts`

| Function | Behavior |
|---|---|
| `getPreferences()` | `getStore("user-preferences").get("default", { type: "json" })`; missing → `{}` |
| `setPreferences(prefs: UserPreferences)` | Write JSON to same key |

Uses `@netlify/blobs`.

### Session gate

Both API handlers call `getSession(cookies)`. If `!session.isLoggedIn` → `401 { ok: false, code: UNAUTHORIZED }`.

Middleware unchanged: `/api/*` is public at middleware layer; routes enforce auth internally (same as login API pattern for unauthenticated POST).

---

## 8. API

### Extended types (`lib/shared/api/types.ts`)

```typescript
export type PreferencesSuccess = { ok: true; displayName?: string };
export type ApiSuccess = { ok: true } | PreferencesSuccess;
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
```

### `GET /api/settings/preferences`

| Condition | HTTP | Body |
|---|---|---|
| Not logged in | 401 | `{ ok: false, code: "UNAUTHORIZED" }` |
| Success | 200 | `{ ok: true, displayName?: string }` |
| Blob/read failure | 500 | `{ ok: false, code: "SERVER_ERROR" }` |

### `PUT /api/settings/preferences`

Request body: `{ displayName?: string }`

| Condition | HTTP | Body |
|---|---|---|
| Not logged in | 401 | `{ ok: false, code: "UNAUTHORIZED" }` |
| Invalid display name | 400 | `{ ok: false, code: "INVALID_DISPLAY_NAME" }` |
| Success | 200 | `{ ok: true, displayName?: string }` |
| Blob/write failure | 500 | `{ ok: false, code: "SERVER_ERROR" }` |

Client resolves errors via `t(code)`.

### New message codes

| Code | Message |
|---|---|
| `INVALID_DISPLAY_NAME` | Display name must be 2–20 characters |
| `UNAUTHORIZED` | You must be logged in |
| `SERVER_ERROR` | Something went wrong. Please try again. |

Existing `NETWORK_ERROR` used for client fetch failures.

---

## 9. Client Logic

### Alpine factories

Register in `app.factory.ts`:

| Factory | File | Purpose |
|---|---|---|
| `userMenu()` | `layout/user.menu.ts` | Open/close dropdown |
| `displayNameSetting(initial?)` | `settings/display-name.setting.ts` | View/edit/save display name |
| `logoutBtn()` | `auth/logout.btn.ts` | Unchanged behavior |

### Display name save flow

1. User clicks save → `PUT /api/settings/preferences { displayName }`
2. Client-side validation before fetch (same rules as server)
3. Success → update local state, switch to view mode (or empty state)
4. Failure → inline error below control (`role="alert"`, `aria-live="polite"`)
5. Save button `:aria-busy` while loading; spinner replaces save icon

---

## 10. Testing

### Approach

Vitest + TDD. Tests in `app/tests/` mirror `lib/` structure.

### Verification order (every task)

```
npm run check  →  npm test  →  npm run build
```

### Test targets

| File | Covers |
|---|---|
| `tests/lib/shared/validation/display-name.test.ts` | trim, empty, min 2, max 20 |
| `tests/lib/server/data/preferences.test.ts` | get/set with mocked blob store |
| `tests/api/settings/preferences.test.ts` | auth, validation, GET/PUT shapes |
| `tests/lib/client/alpine/layout/user.menu.test.ts` | toggle open/close |
| `tests/lib/client/alpine/settings/display-name.setting.test.ts` | view/edit/save, errors |

### Manual smoke tests

1. Logged-in `/` shows header with profile icon (no standalone logout on page)
2. Profile menu opens; "Account settings" navigates to `/settings`
3. Logout from menu ends session → `/login`
4. `/settings` without display name → empty input + save
5. Save valid name → view mode with read-only text + edit icon
6. Edit → change → save → updated view
7. Save empty → cleared state (empty input)
8. Save 1-char or 21-char name → validation error
9. Unauthenticated API call → 401

---

## 11. Local Development

| Command | Auth | Blobs |
|---|---|---|
| `astro dev` | Works | Blob reads/writes may fail without Netlify context |
| `netlify dev` | Works | Full Blob persistence |

Document in implementation plan: use `netlify dev` when testing preference save/load locally.

---

## 12. Out of Scope

- Password / credential change
- Multi-user preferences
- Theme or game-mode settings
- Full site navigation / breadcrumbs
- Cancel button in display name edit mode
- Dropdown focus trap / arrow-key menu navigation
- Display name shown in header (future)

---

## 13. Dependencies

| Package | Status | Purpose |
|---|---|---|
| `@netlify/blobs` | Transitive via adapter | Preferences storage |
| Existing stack | — | Astro, Alpine, iron-session, Vitest |

No new npm packages required unless implementation discovers adapter does not expose blobs directly (verify during plan).

---

## 14. Brainstorming Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Settings v1 scope | Display name only; page will grow later |
| 2 | Storage | Netlify Blobs JSON document (approach 1) |
| 3 | API | Astro API routes → Netlify Functions; no DB |
| 4 | Edit UX | View + edit icon → inline input + save (option A) |
| 5 | Layout | `AppLayout` wraps `BaseLayout` + `AppHeader` + slot; login uses `BaseLayout` only |
| 6 | Validation | Optional; 2–20 chars when set; empty clears; no uniqueness |
| 7 | Header | Profile dropdown with Account settings link + logout |
| 8 | IconBtn | Shared primitive for profile, logout, save, edit buttons |
