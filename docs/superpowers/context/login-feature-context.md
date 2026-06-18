# Login Feature — Brainstorming Context

> Living document for handoff between agents/context windows. Updated after each brainstorming decision.

**Status:** Superseded by Neon Auth migration (2026-06-18)  
**Last updated:** 2026-06-18  
**Branch:** `blob-to-database-migration`

---

## Auth (current — Neon Auth)

| Item | Value |
|---|---|
| Platform | Neon Auth (managed Better Auth) |
| Login | Email + password via Alpine `LoginForm` → `POST /api/auth/login` → proxy `sign-in/email` |
| Session | `getSession(request)` proxies `get-session`; returns `AppSession` with `userId`, `email`, `name` |
| Logout | `POST /api/auth/logout` → proxy `sign-out` |
| Catch-all | `/api/auth/[...path]` via `createNeonAuth().handler()` |
| Env | `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (not `AUTH_USERNAME` / `SESSION_SECRET`) |
| User provisioning | `npm run seed:auth` — one-time `sign-up/email`; no signup UI |

**Spec:** `docs/superpowers/specs/2026-06-18-neon-auth-migration-design.md`

---

## Project Snapshot (historical pre-Neon)

| Item | Value |
|---|---|
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Hosting | Netlify (Functions + Blobs for future app data) |
| Existing pages | `/` (Home, placeholder), `/login` (placeholder) |
| Existing layout | `app/src/layouts/BaseLayout.astro` |
| Config | `app/astro.config.mjs` — Tailwind + Alpine integrations |

---

## Feature Scope

Single-user authentication gate. Login page + session management + route protection + logout API. No logout UI in this feature. No signup flow. Credentials pre-configured via environment variables.

---

## Decisions Log

| # | Topic | Question | Answer |
|---|---|---|---|
| 1 | User model | Who is logging in? | **A** — Single-user; login gates own dart data |
| 2 | Credentials | How to authenticate? | **B variant** — Username + password (not email) |
| 3 | Account setup | How are credentials created? | **C** — Pre-configured via `.env` + `.env.example`; login page only |
| 4 | Session | Session behavior after login? | **B** — Persistent cookie (~30 days, survives browser restart) |
| 5 | UI layout | Login page layout? | **A** — Centered card on neutral background |
| 6 | UI content | Card content? | **Custom** — Title "Dart Counter"; description "Welcome to your personalized dart counter app, tracking your every step of progress towards a higher average."; username input; password input; login button |
| 7 | UI errors | Error display? | **A** — Inline red text below the button |
| 8 | UI loading | Submit in progress? | **C variant** — Spinner on button; label hidden while loading |
| 9 | UI theme | Visual style? | **B** — Dark theme (dark card + dark page background) |
| 18 | UI theming | Color consistency? | **Custom** — Define app color tokens in `global.css` `@theme` block (Tailwind v4); use semantic tokens (`surface-page`, `surface-card`, `text-primary`, etc.) not raw hex in components |
| 19 | UI layout system | Component styling? | **Custom** — `@container` only on components in `src/components/`; page shells use viewport utilities. Child styles within components use container query variants (`@sm:`, etc.) relative to the component root |
| 20 | UI components | Component structure? | **Custom** — `LoginForm.astro` exports the card + form (Alpine logic, states); `login.astro` is thin page shell (layout + section wrapper + import) |
| 21 | UI containers | Where does `@container` apply? | **Custom** — Not on page-level `<section>` in `login.astro`; only inside `LoginForm.astro` (and future components) |
| 22 | Alpine setup | Client logic location? | **Custom** — Alpine factories in `src/lib/client/alpine/`. Register via `alpinejs({ entrypoint: '/src/lib/client/alpine/app.factory' })`. Static imports via `@lib/*` path alias; no `<script>` tags in components |
| 23 | Alpine entrypoint | Entrypoint file name? | **`lib/client/alpine/app.factory.ts`** — central registry for all `Alpine.data()` factories |
| 24 | Import aliases | Path aliases? | **`@lib/*`** → `src/lib/*` in `tsconfig.json` (alongside existing `@styles/*`, `@layouts/*`) |
| 10 | Logic — redirect | Unauthenticated user hits protected page? | **A** — Redirect to `/login?redirect=<original>`, return after success |
| 11 | Logic — logged in | Already logged in, visit `/login`? | **A** — Redirect to `redirect` param or `/` |
| 12 | Logic — password | Password in `.env`? | **A** — Plain text, direct comparison |
| 13 | Logic — submit | Form submission? | **A** — Alpine.js fetch → API route → JSON response; client handles redirect/errors |
| 14 | Logic — session store | Session storage? | **Custom** — Netlify Functions + Blobs platform; session via signed HTTP-only cookie (stateless). Blobs reserved for app data later, not auth sessions |
| 15 | Logic — logout | Logout in scope? | **A** — Logout API route yes; UI later |
| 16 | Dependencies — dev | Local development? | **C** — `astro dev` day-to-day (Netlify Vite plugin emulates functions/env since Astro 5.12); `netlify dev` optional for pre-deploy validation |
| 25 | Netlify config | `netlify.toml` build section? | **No** — Netlify auto-detects Astro (`astro build`, publish `dist`); `netlify.toml` not required. Configure `base = "app"` in Netlify UI if needed (monorepo) |
| 26 | Env vars (Astro 6) | Runtime env access? | **`process.env`** in server/API/middleware code — NOT `import.meta.env` (inlined at build time in Astro 6) |
| 27 | API responses | Response format? | **Typed + destructured** — shared types in `@lib/shared/api/types.ts`; API returns `{ ok, code? }` shape; client/server destructure consistently |
| 28 | Messaging | User-facing strings? | **Centralized i18n** — `@lib/shared/i18n/` with `t()` helper; error codes + messages in `@lib/shared/constants/errors.constants.ts` |
| 29 | Constants | Error messages location? | **`lib/shared/constants/errors.constants.ts`** — `MessageCode` + message strings; i18n reads from constants (English now, locales later) |
| 30 | Testing | Test approach? | **Vitest + TDD** — `tests/` folder; verification order: `npm run check` → `npm test` → `npm run build` |
| 31 | Lib structure | Folder organization? | **Runtime boundaries** — `lib/client/`, `lib/server/`, `lib/shared/` subfolders; domain subfolders within each (`auth/`, `alpine/`, `api/`, etc.) |
| 32 | UI primitives | Reusable components? | **`components/ui/`** — `Input.astro`, `PrimaryBtn.astro`; feature components compose primitives; semantic HTML throughout |
| 17 | Architecture | Session/auth approach? | **Approach 1** — `iron-session` + signed cookie via `@astrojs/netlify` |

---

## Approved Architecture (Approach 1)

- **Session:** `iron-session` encrypted/signed HTTP-only cookie, 30-day max age, stateless (no blob reads per request)
- **Auth routes:** Astro API routes deployed as Netlify Functions
  - `POST /api/auth/login` — validate credentials, set session cookie
  - `POST /api/auth/logout` — destroy session cookie
- **Route protection:** Astro middleware — check session, redirect unauthenticated users to `/login?redirect=...`
- **Login page:** Alpine.js component — fetch login API, handle spinner/errors/redirect
- **Env vars:** `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET` (in `.env` + `.env.example`)
- **New dependencies:** `@astrojs/netlify`, `iron-session`; dev: `netlify-cli`, `@netlify/functions`
- **Astro config:** `output: 'server'`, Netlify adapter
- **Cost:** All libraries MIT/free; Netlify Starter tier sufficient for this feature

---

## Design Sections (approval status)

| Section | Status |
|---|---|
| Architecture | Approved |
| UI | Approved |
| Logic & data flow | Approved |
| Dependencies & config | Approved |
| Error handling | Approved |
| UI (incl. ui/ primitives) | Approved |
| Testing | Approved |

---

## UI Design (revised)

### Theme tokens (`app/src/styles/global.css`)

Define semantic color tokens in `@theme` — all components use these utilities, never hardcoded colors:

```css
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-surface-page: oklch(0.13 0.01 260);
  --color-surface-card: oklch(0.18 0.01 260);
  --color-surface-input: oklch(0.22 0.01 260);

  /* Text */
  --color-text-primary: oklch(0.95 0 0);
  --color-text-muted: oklch(0.65 0.01 260);

  /* Interactive */
  --color-accent: oklch(0.62 0.19 145);
  --color-accent-hover: oklch(0.55 0.19 145);

  /* Feedback */
  --color-error: oklch(0.65 0.2 25);
  --color-border: oklch(0.28 0.01 260);
}
```

Generates utilities: `bg-surface-page`, `text-text-primary`, `bg-accent`, `text-error`, etc.

### Astro component split

**`login.astro`** — page shell; `<main>` for primary content (viewport layout only):

```astro
---
import BaseLayout from "@layouts/BaseLayout.astro";
import LoginForm from "@components/forms/LoginForm.astro";
---
<BaseLayout title="Login">
  <main class="min-h-screen flex items-center justify-center bg-surface-page p-4">
    <LoginForm />
  </main>
</BaseLayout>
```

**`components/forms/LoginForm.astro`** — feature component composing UI primitives:

```astro
---
import Input from "@components/ui/Input.astro";
import PrimaryBtn from "@components/ui/PrimaryBtn.astro";
import { sanitizeRedirect } from "@lib/shared/utils/redirect";

const redirect = sanitizeRedirect(Astro.url.searchParams.get("redirect"));
---
<article class="@container w-full max-w-sm rounded-lg border border-border bg-surface-card p-6 @sm:p-8">
  <header class="space-y-2">
    <h1 id="login-heading" class="text-text-primary @sm:text-xl font-semibold">Dart Counter</h1>
    <p class="text-text-muted @sm:text-sm">
      Welcome to your personalized dart counter app, tracking your every step
      of progress towards a higher average.
    </p>
  </header>

  <form
    class="mt-6 space-y-4"
    x-data="loginForm()"
    @submit.prevent="submit"
    data-redirect={redirect}
    aria-labelledby="login-heading"
  >
    <fieldset class="space-y-4 border-0 p-0">
      <legend class="sr-only">Sign in</legend>

      <Input
        id="username"
        name="username"
        label="Username"
        type="text"
        autocomplete="username"
        required
        x-model="username"
      />

      <Input
        id="password"
        name="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        required
        x-model="password"
      />
    </fieldset>

    <PrimaryBtn>Login</PrimaryBtn>

    <p
      x-show="error"
      x-text="error"
      x-cloak
      class="text-error text-sm"
      role="alert"
      aria-live="polite"
    ></p>
  </form>
</article>
```

**`components/ui/Input.astro`** — labeled input primitive:

```astro
---
interface Props {
  id: string;
  name: string;
  label: string;
  type?: "text" | "password" | "email";
  autocomplete?: string;
  required?: boolean;
  "x-model"?: string;
}
const { id, name, label, type = "text", autocomplete, required, "x-model": xModel } = Astro.props;
---
<div class="space-y-1">
  <label for={id} class="text-text-muted @sm:text-sm block">{label}</label>
  <input
    {id}
    {name}
    {type}
    {autocomplete}
    {required}
    x-model={xModel}
    class="w-full rounded-md border border-border bg-surface-input px-3 py-2 text-text-primary"
  />
</div>
```

**`components/ui/PrimaryBtn.astro`** — submit button with built-in loading state (expects Alpine `loading` in scope):

```astro
<button
  type="submit"
  :disabled="loading"
  :aria-busy="loading"
  class="relative w-full rounded-md bg-accent px-4 py-2 text-text-primary hover:bg-accent-hover disabled:opacity-70"
>
  <span x-show="!loading" x-cloak><slot /></span>
  <span
    x-show="loading"
    x-cloak
    class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-text-primary border-t-transparent"
    aria-hidden="true"
  ></span>
</button>
```

### Component hierarchy

```
components/
├── ui/                    # Reusable primitives (no business logic)
│   ├── Input.astro
│   └── PrimaryBtn.astro
└── forms/                 # Feature-specific compositions
    └── LoginForm.astro
```

### Semantic HTML rules

| Element | Usage |
|---|---|
| `<main>` | Page-level primary content (`login.astro`) |
| `<article>` | Self-contained card (`LoginForm`) |
| `<header>` | Title + description within card |
| `<form>` | Login submission; `aria-labelledby` points to heading |
| `<fieldset>` + `<legend class="sr-only">` | Groups related inputs accessibly |
| `<label for>` | Every input linked via `Input.astro` |
| `role="alert"` + `aria-live="polite"` | Error message |
| `:aria-busy` | Submit button loading state |
| `autocomplete` | `username` / `current-password` on inputs |

### Container query rules

**`src/lib/client/alpine/app.factory.ts`** — Alpine entrypoint:

```typescript
import type { Alpine } from "alpinejs";
import { loginForm } from "@lib/client/alpine/forms/login.form";

export default (Alpine: Alpine) => {
  Alpine.data("loginForm", loginForm);
};
```

**`src/lib/client/alpine/forms/login.form.ts`** — Alpine data factory:

- Exported `loginForm()` factory for `x-data="loginForm()"`
- Reads `data-redirect` from form element
- `POST /api/auth/login` with `{ username, password }`
- Handles loading spinner, error display, redirect via `t(code)`

**`astro.config.mjs`** — entrypoint wiring:

```javascript
integrations: [alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" })]
```

### Container query rules

- **`@container` only in `src/components/`** — page files (`login.astro`, `index.astro`) use viewport utilities (`min-h-screen`, `flex`, etc.)
- Component root `<article>` in `LoginForm.astro` gets `@container`; children use `@sm:`, `@md:` variants relative to the card width
- No viewport `md:`/`lg:` on component internals

### Card content & states (unchanged)

| Element | Token classes |
|---|---|
| Page bg | `bg-surface-page` |
| Card | `bg-surface-card border-border` |
| Title | `text-text-primary` |
| Description | `text-text-muted` |
| Inputs | `Input.astro` — `bg-surface-input border-border text-text-primary` |
| Button | `PrimaryBtn.astro` — `bg-accent hover:bg-accent-hover` |
| Error | `text-error` below button |
| Loading | Spinner replaces button label; button disabled |

---

## Logic & Data Flow (approved)

### Login
1. `login.form.ts` → `POST /api/auth/login { username, password }`
2. API compares to `process.env.AUTH_USERNAME` / `process.env.AUTH_PASSWORD`
3. Match → iron-session cookie `{ isLoggedIn: true }`, 30-day maxAge → `{ ok: true }` → client redirects
4. No match → `{ ok: false, error: "Invalid username or password" }`, 401

### Middleware
| Request | Action |
|---|---|
| `/login`, `/api/*`, static assets | Pass through |
| Valid session + `/login` | Redirect to `?redirect=` or `/` |
| No session + protected route | Redirect to `/login?redirect=<path>` |
| Valid session + protected route | Continue |

### Logout API
- `POST /api/auth/logout` — destroys session, returns `{ ok: true }`, no UI

### Session (`lib/server/auth/session.ts`)
- `iron-session` + `SESSION_SECRET`
- Cookie: `httpOnly`, `secure` in production, `sameSite: 'lax'`, `maxAge: 30 days`
- Payload: `{ isLoggedIn: boolean }`

---

## Error Handling (approved)

### Typed API responses (`lib/shared/api/types.ts`)

```typescript
import type { MessageCode } from "@lib/shared/constants/errors.constants";

export type ApiSuccess = { ok: true };
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
```

API routes return typed `ApiResponse` — message **codes**, not raw strings. Client destructures `{ ok, code }` and resolves via `t(code)`.

### Error constants (`lib/shared/constants/errors.constants.ts`)

```typescript
export const MessageCode = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  MISSING_FIELDS: "MISSING_FIELDS",
  SERVER_CONFIG: "SERVER_CONFIG",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export type MessageCode = (typeof MessageCode)[keyof typeof MessageCode];

export const errorMessages: Record<MessageCode, string> = {
  [MessageCode.INVALID_CREDENTIALS]: "Invalid username or password",
  [MessageCode.MISSING_FIELDS]: "Username and password are required",
  [MessageCode.SERVER_CONFIG]: "Server configuration error",
  [MessageCode.NETWORK_ERROR]: "Unable to connect. Please try again.",
};
```

### i18n helper (`lib/shared/i18n/index.ts`)

```typescript
import { errorMessages, type MessageCode } from "@lib/shared/constants/errors.constants";

export function t(code: MessageCode, locale = "en"): string {
  // locale switch added when second language is introduced
  return errorMessages[code];
}
```

Add locale-specific constant files (e.g. `errors.nl.constants.ts`) later; `t()` selects by locale.

### Error scenarios

| Scenario | HTTP | Response | Client |
|---|---|---|---|
| Wrong credentials | 401 | `{ ok: false, code: "INVALID_CREDENTIALS" }` | `t(code)` below button |
| Missing fields | 400 | `{ ok: false, code: "MISSING_FIELDS" }` | `t(code)` below button |
| Missing env vars | 500 | `{ ok: false, code: "SERVER_CONFIG" }` | `t(code)` below button |
| Network failure | — | — | `t("NETWORK_ERROR")` |
| Invalid redirect | — | — | Sanitize to `/` |

---

## Testing (approved)

### Approach: Vitest + TDD

Tests live in `app/tests/` mirroring `src/lib/` structure. Write failing tests first, then implement.

### Verification order (every task / pre-commit)

```
npm run check  →  npm test  →  npm run build
```

| Step | Command | Purpose |
|---|---|---|
| 1 | `npm run check` | TypeScript + Astro type checking |
| 2 | `npm test` | Vitest unit/integration tests |
| 3 | `npm run build` | Production build validation |

### New devDependencies

| Package | Purpose |
|---|---|
| `vitest` | Test runner |
| `@vitest/coverage-v8` (optional) | Coverage reports |

### `package.json` scripts

```json
"test": "vitest run",
"test:watch": "vitest"
```

### Test targets (initial)

| File | Tests |
|---|---|
| `tests/lib/shared/constants/errors.constants.test.ts` | MessageCode values, errorMessages completeness |
| `tests/lib/shared/i18n/index.test.ts` | `t()` returns correct string per code |
| `tests/lib/server/auth/session.test.ts` | Session config, cookie options |
| `tests/api/auth/login.test.ts` | Credential validation, response shapes, status codes |
| `tests/api/auth/logout.test.ts` | Session destruction |
| `tests/lib/shared/utils/redirect.test.ts` | Redirect param sanitization |
| `tests/lib/client/alpine/forms/login.form.test.ts` | Form submit, error display, redirect |

### Manual smoke tests (post-build)

| # | Test | Expected |
|---|---|---|
| 1 | Visit `/` unauthenticated | Redirect to `/login?redirect=/` |
| 2 | Login with wrong credentials | Error via `t(code)` below button |
| 3 | Login with valid credentials | Redirect to `/` or `redirect` param |
| 4 | Visit `/login` while logged in | Redirect away |
| 5 | Reload `/` after login | Still authenticated |
| 6 | Loading state on submit | Spinner, label hidden, button disabled |

---

## Lib Folder Architecture (approved)

Organized by **runtime boundary** first, **domain** second. Prevents server code leaking into client bundles and scales as features grow.

```
src/lib/
├── client/                         # Browser-only (Alpine, fetch UI logic)
│   └── alpine/
│       ├── app.factory.ts          # Astro Alpine entrypoint
│       └── forms/
│           └── login.form.ts       # x-data="loginForm()"
├── server/                         # Node / Netlify Functions only
│   └── auth/
│       ├── session.ts              # iron-session config + helpers
│       └── credentials.ts          # env credential validation (extracted from login API)
│   └── data/                       # (future) Netlify Blobs helpers
├── shared/                         # Isomorphic — safe for client + server
│   ├── api/
│   │   └── types.ts                # ApiResponse, ApiSuccess, ApiError
│   ├── constants/
│   │   └── errors.constants.ts     # MessageCode + errorMessages
│   ├── i18n/
│   │   └── index.ts                # t(code, locale?)
│   └── utils/
│       └── redirect.ts             # sanitizeRedirect()
```

### Import conventions

| Import from | Example |
|---|---|
| `@lib/client/alpine/forms/login.form` | Alpine factory |
| `@lib/server/auth/session` | Session in API routes + middleware |
| `@lib/shared/api/types` | Response typing |
| `@lib/shared/constants/errors.constants` | Message codes |
| `@lib/shared/i18n` | `t()` helper |
| `@lib/shared/utils/redirect` | Redirect sanitization |

### Growth examples (future features)

| Feature | Location |
|---|---|
| Game scoring logic (client) | `lib/client/alpine/forms/game.form.ts` |
| Dart stats (server + blobs) | `lib/server/data/stats.ts` |
| Route constants | `lib/shared/constants/routes.constants.ts` |
| Dutch locale | `lib/shared/constants/errors.nl.constants.ts` |

### Tests mirror lib structure

```
tests/lib/
├── client/alpine/forms/login.form.test.ts
├── server/auth/session.test.ts
└── shared/
    ├── constants/errors.constants.test.ts
    ├── i18n/index.test.ts
    └── utils/redirect.test.ts
```

---

## File Targets (anticipated)

```
app/
├── astro.config.mjs              # Netlify adapter, Alpine entrypoint
├── tsconfig.json                 # Add @lib/* path alias
├── .env.example                  # AUTH_USERNAME, AUTH_PASSWORD, SESSION_SECRET
│   # No netlify.toml — Netlify auto-detects Astro build settings
├── src/
│   ├── middleware.ts             # Route protection
│   ├── lib/
│   │   ├── client/
│   │   │   └── alpine/
│   │   │       ├── app.factory.ts
│   │   │       └── forms/login.form.ts
│   │   ├── server/
│   │   │   └── auth/
│   │   │       ├── session.ts
│   │   │       └── credentials.ts
│   │   └── shared/
│   │       ├── api/types.ts
│   │       ├── constants/errors.constants.ts
│   │       ├── i18n/index.ts
│   │       └── utils/redirect.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Input.astro           # Labeled input primitive
│   │   │   └── PrimaryBtn.astro      # Submit button + loading spinner
│   │   └── forms/
│   │       └── LoginForm.astro       # Login card composing ui/ primitives
│   ├── pages/
│   │   ├── login.astro           # Thin page shell (layout + section + LoginForm)
│   │   └── api/auth/
│   │       ├── login.ts          # POST login
│   │       └── logout.ts         # POST logout
│   └── styles/
│       └── global.css            # @theme color tokens
├── tests/
│   ├── lib/
│   │   ├── client/alpine/forms/login.form.test.ts
│   │   ├── server/auth/session.test.ts
│   │   └── shared/
│   │       ├── constants/errors.constants.test.ts
│   │       ├── i18n/index.test.ts
│   │       └── utils/redirect.test.ts
│   └── api/auth/
│       ├── login.test.ts
│       └── logout.test.ts
├── vitest.config.ts              # Vitest config
docs/superpowers/
├── context/login-feature-context.md   # This file
└── specs/2026-06-13-login-design.md   # Design spec (writing-plans input)
```

---

## Next Steps

1. ~~Write spec~~ → `docs/superpowers/specs/2026-06-13-login-design.md`
2. User reviews spec
3. Invoke `writing-plans` skill (plan exists at `docs/superpowers/plans/2026-06-13-login.md` — align with spec if needed)
