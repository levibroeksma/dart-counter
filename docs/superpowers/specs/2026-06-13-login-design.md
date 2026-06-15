# Login Feature — Design Spec

> Input for `writing-plans` skill. Full brainstorming context: `docs/superpowers/context/login-feature-context.md`

**Date:** 2026-06-13  
**Branch:** `login-interface`  
**Scope:** Single feature — login, session, route protection, logout API (no logout UI, no signup)

---

## 1. Overview

Single-user authentication gate for Dart Counter. Pre-configured credentials via `.env`. Persistent 30-day session. Deployed on Netlify with Astro 6 SSR.

| Item | Value |
|---|---|
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Hosting | Netlify (Functions; Blobs reserved for future app data) |
| Session | `iron-session` signed HTTP-only cookie (stateless) |
| Dev | `astro dev` primary; `netlify dev` optional pre-deploy |

---

## 2. Architecture

```
Browser                    Astro (Netlify)                 process.env
───────                    ───────────────                 ───────────
/login (Alpine) ──POST──► /api/auth/login ──reads──► AUTH_USERNAME
                           (Netlify Function)              AUTH_PASSWORD
     │                              │
     │◄── { ok } / { ok, code } ────┤ sets iron-session cookie (30d)
     │                              │
     └── redirect to ?redirect=     │
                                     │
Protected page ──middleware──► session valid?
                                     │ no  → /login?redirect=<path>
                                     │ yes → continue

POST /api/auth/logout ──► clears session (no UI this feature)
```

**Env vars** (`.env` + `.env.example`, read via `process.env` — never `import.meta.env` for secrets in Astro 6):

| Variable | Purpose |
|---|---|
| `AUTH_USERNAME` | Expected username (plain text) |
| `AUTH_PASSWORD` | Expected password (plain text) |
| `SESSION_SECRET` | Cookie encryption key (32+ chars) |

**Netlify:** No `netlify.toml` build section — auto-detects `astro build` / `dist`. Set base directory `app` in Netlify UI (monorepo).

---

## 3. File Structure

```
app/
├── astro.config.mjs              # output: 'server', Netlify adapter, Alpine entrypoint
├── tsconfig.json                 # @lib/*, @components/* path aliases
├── vitest.config.ts
├── .env.example
├── src/
│   ├── middleware.ts
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
│   │   │   ├── Input.astro
│   │   │   └── PrimaryBtn.astro
│   │   └── forms/
│   │       └── LoginForm.astro
│   ├── pages/
│   │   ├── login.astro
│   │   ├── index.astro
│   │   └── api/auth/login.ts, logout.ts
│   └── styles/global.css
└── tests/                        # mirrors lib/ structure
```

### Lib organization

| Layer | Purpose | Example |
|---|---|---|
| `lib/client/` | Browser-only | Alpine forms |
| `lib/server/` | Netlify Functions / Node | Session, credentials |
| `lib/shared/` | Isomorphic | Types, constants, i18n, utils |

---

## 4. UI Design

### Theme tokens (`global.css` `@theme`)

Semantic tokens only — no raw colors in components:

- Surfaces: `surface-page`, `surface-card`, `surface-input`
- Text: `text-primary`, `text-muted`
- Interactive: `accent`, `accent-hover`
- Feedback: `error`, `border`

### Component hierarchy

```
components/
├── ui/           # Primitives — styling + semantics, no business logic
│   ├── Input.astro
│   └── PrimaryBtn.astro
└── forms/        # Feature compositions
    └── LoginForm.astro
```

### Layout rules

- **Pages:** viewport utilities only (`min-h-screen`, `flex`); no `@container`
- **Components:** `@container` on root element; children use `@sm:` variants relative to component width
- **No viewport `md:`/`lg:`** on component internals

### Semantic HTML

| Element | Location |
|---|---|
| `<main>` | `login.astro` |
| `<article>` | `LoginForm.astro` card |
| `<header>` | Title + description |
| `<form aria-labelledby="login-heading">` | Login submission |
| `<fieldset>` + `<legend class="sr-only">` | Input group |
| `role="alert"` + `aria-live="polite"` | Error message |
| `:aria-busy` | `PrimaryBtn` loading state |

### Card content

- **Title:** Dart Counter
- **Description:** Welcome to your personalized dart counter app, tracking your every step of progress towards a higher average.
- **Fields:** Username, Password
- **Button:** Login (spinner replaces label while loading)
- **Error:** Inline below button via `t(code)`

### Alpine setup

- Entrypoint: `/src/lib/client/alpine/app.factory` in `astro.config.mjs`
- Factory: `@lib/client/alpine/forms/login.form`
- No `<script>` tags in Astro components

---

## 5. Logic & Data Flow

### Login

1. `login.form.ts` → `POST /api/auth/login { username, password }`
2. `credentials.ts` validates against `process.env`
3. Success → session `{ isLoggedIn: true }`, 30-day cookie → `{ ok: true }` → client redirects
4. Failure → `{ ok: false, code: MessageCode }` with appropriate HTTP status

### Middleware

| Request | Action |
|---|---|
| `/login`, `/api/*`, static assets | Pass through |
| Valid session + `/login` | Redirect to sanitized `redirect` or `/` |
| No session + protected route | Redirect to `/login?redirect=<path>` |
| Valid session + protected route | Continue |

### Session (`lib/server/auth/session.ts`)

- `iron-session` + `process.env.SESSION_SECRET`
- Cookie: `httpOnly`, `secure` in production, `sameSite: 'lax'`, `maxAge: 30 days`
- Payload: `{ isLoggedIn: boolean }`

### Redirect sanitization (`lib/shared/utils/redirect.ts`)

- Must start with `/`, must not start with `//`
- Fallback: `/`

---

## 6. API Responses & i18n

### Types (`lib/shared/api/types.ts`)

```typescript
export type ApiSuccess = { ok: true };
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
```

API returns **codes**; client destructures `{ ok, code }` and resolves via `t(code)`.

### Constants (`lib/shared/constants/errors.constants.ts`)

| Code | Message |
|---|---|
| `INVALID_CREDENTIALS` | Invalid username or password |
| `MISSING_FIELDS` | Username and password are required |
| `SERVER_CONFIG` | Server configuration error |
| `NETWORK_ERROR` | Unable to connect. Please try again. |

### i18n (`lib/shared/i18n/index.ts`)

`t(code, locale = "en")` reads from constants. Add locale files later without changing API or components.

### Error scenarios

| Scenario | HTTP | Response |
|---|---|---|
| Wrong credentials | 401 | `{ ok: false, code: "INVALID_CREDENTIALS" }` |
| Missing fields | 400 | `{ ok: false, code: "MISSING_FIELDS" }` |
| Missing env vars | 500 | `{ ok: false, code: "SERVER_CONFIG" }` |
| Network failure | — | Client uses `NETWORK_ERROR` |

Same message for wrong username vs password (no enumeration).

---

## 7. Dependencies

| Package | Type | Purpose |
|---|---|---|
| `@astrojs/netlify` | dependency | SSR adapter |
| `iron-session` | dependency | Session cookies |
| `vitest` | devDependency | Test runner |
| `jsdom` | devDependency | DOM tests for Alpine forms |
| `netlify-cli` | devDependency (optional) | Pre-deploy validation |

Install: `npx astro add netlify`, `npm install iron-session`, `npm install -D vitest jsdom`

---

## 8. Testing

### Approach: Vitest + TDD

Write failing tests first. Tests in `app/tests/` mirror `lib/` structure.

### Verification order (every task)

```
npm run check  →  npm test  →  npm run build
```

### Test targets

| File | Covers |
|---|---|
| `tests/lib/shared/constants/errors.constants.test.ts` | MessageCode completeness |
| `tests/lib/shared/i18n/index.test.ts` | `t()` lookup |
| `tests/lib/shared/utils/redirect.test.ts` | Redirect sanitization |
| `tests/lib/server/auth/session.test.ts` | Session config |
| `tests/lib/client/alpine/forms/login.form.test.ts` | Form submit, errors, redirect |
| `tests/api/auth/login.test.ts` | API validation, response shapes |
| `tests/api/auth/logout.test.ts` | Session destruction |

### Manual smoke tests (post-build)

1. Unauthenticated `/` → redirect to `/login?redirect=/`
2. Wrong credentials → error below button
3. Valid login → redirect to `/` or `redirect` param
4. Logged-in visit to `/login` → redirect away
5. Reload `/` → still authenticated
6. Submit → spinner, label hidden, button disabled

---

## 9. Out of Scope

- Logout UI
- Signup / first-run setup
- Multi-user accounts
- Password hashing
- Netlify Blobs (auth sessions)
- `netlify.toml` build config

---

## 10. Path Aliases (`tsconfig.json`)

```json
{
  "paths": {
    "@styles/*": ["./src/styles/*"],
    "@layouts/*": ["./src/layouts/*"],
    "@lib/*": ["./src/lib/*"],
    "@components/*": ["./src/components/*"]
  }
}
```
