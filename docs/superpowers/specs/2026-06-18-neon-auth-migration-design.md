# Neon Auth Migration — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-18  
**Branch:** TBD  
**Scope:** Replace env-based credentials + `iron-session` with Neon Auth (managed Better Auth). Auth only — no game data / blob migration.

---

## 1. Overview

Dart Counter currently authenticates a single user via `AUTH_USERNAME` / `AUTH_PASSWORD` in env, stores session state in an `iron-session` cookie (`dart-counter-session`), and keys downstream APIs with `session.username`. Neon Auth is already provisioned on project `my-dart-counter`; this migration wires the Astro app to it.

| Decision | Choice |
|---|---|
| Auth platform | Neon Auth (managed Better Auth) |
| Users | Single pre-provisioned user, login only |
| UI | Keep Alpine `LoginForm` (email + password fields) |
| Session | Neon Auth cookies only — remove `iron-session` |
| `userId` | Neon `user.id` (UUID) |
| Data keys | **Not migrated** — blob data keyed by old `username` won't match until a future data migration |

---

## 2. Architecture

```
Browser                 Astro (Netlify SSR)                    Neon Auth
───────                 ───────────────────                    ─────────
/login (Alpine)
  POST /api/auth/login ──► login wrapper ──proxy──► sign-in/email
                              │                         (sets session cookies)
                              ◄── Set-Cookie ───────────┘

Protected page ──middleware──► getSession() ──proxy──► get-session
                              │                         (cookie cache + upstream)
                              │ no session → /login?redirect=

POST /api/auth/logout ──► logout wrapper ──proxy──► sign-out

/api/auth/[...path] ──► authApiHandler (catch-all proxy for Neon Auth API)
```

**SDK choice:** `@neondatabase/auth` exports `authApiHandler` — framework-agnostic, uses standard `Request`/`Response`. Suitable for Astro without Next.js `cookies()` / `headers()`.

**Not used:** `createNeonAuth()` from `@neondatabase/auth/next/server` — its `signIn` / `getSession` helpers depend on `next/headers` and are incompatible with Astro.

**Route precedence:** Named routes `/api/auth/login` and `/api/auth/logout` take priority over the catch-all `[...path]` route.

---

## 3. Session model

```typescript
/** App-level session facade (replaces iron-session SessionData). */
export type AppSession = {
  isLoggedIn: boolean;
  userId?: string;   // Neon user.id (UUID)
  email?: string;
  name?: string;
};
```

**`getSession` signature change:** `getSession(cookies)` → `getSession(request: Request)` (reads `Cookie` header from the incoming request). All call sites must pass `context.request` / `Astro.request` instead of `cookies` alone.

**Obsolete symbols removed with iron-session:**

| Removed | Replacement |
|---|---|
| `SessionData` | `AppSession` |
| `sessionOptions` | — (Neon manages cookie config) |
| `SESSION_MAX_AGE_SECONDS` | — (Neon session TTL) |
| `session.username` | `session.userId` |
| `session.save()` / `session.destroy()` | Proxy `sign-in` / `sign-out`; Set-Cookie forwarding |
| Cookie `dart-counter-session` | Neon Auth session cookies (managed by SDK proxy) |

---

## 4. New & changed files

| Action | File | Notes |
|---|---|---|
| **Add** | `src/lib/server/auth/neon.ts` | `authApiHandler` config, `proxyAuthRequest()`, `forwardSetCookieHeaders()` |
| **Add** | `src/pages/api/auth/[...path].ts` | Catch-all Neon Auth proxy (`GET`, `POST`, etc.) |
| **Add** | `scripts/seed-neon-auth-user.ts` | One-time `sign-up/email` for the single user |
| **Rewrite** | `src/lib/server/auth/session.ts` | `getSession(request)` via `get-session` proxy |
| **Delete** | `src/lib/server/auth/credentials.ts` | Env credential validation — obsolete |
| **Rewrite** | `src/pages/api/auth/login.ts` | Proxy `sign-in/email`; forward `Set-Cookie` |
| **Rewrite** | `src/pages/api/auth/logout.ts` | Proxy `sign-out`; forward clearing cookies |
| **Update** | `src/middleware.ts` | `getSession(context.request)` |
| **Update** | `LoginForm.astro` | `username` field → `email`; `autocomplete="email"` |
| **Update** | `login.form.ts` | `username` state → `email`; POST body `{ email, password }` |
| **Update** | `errors.constants.ts` | Email-oriented copy for login errors |
| **Update** | `bootstrap-env.ts` | Drop early-return guard on `AUTH_*` / `SESSION_SECRET` |
| **Update** | `.env.example` | Remove legacy auth vars; add `NEON_AUTH_COOKIE_SECRET` |
| **Update** | `package.json` | Add `@neondatabase/auth`; remove `iron-session` |
| **Update** | `vitest.config.ts` | Replace legacy env with Neon auth test env |

---

## 5. Identity rename (`username` → `userId`)

All auth guards and data-layer keys must use `session.userId` / `auth.userId` instead of `.username`.

### Production source files (28 files)

| File | Change |
|---|---|
| `src/pages/index.astro` | `session.username ?? "default"` → `session.userId` (drop `"default"` fallback when logged in) |
| `src/pages/games/[game].astro` | 6 references |
| `src/pages/games/settings-[game].astro` | 6 references |
| `src/pages/api/games/index.ts` | guard + usage |
| `src/pages/api/games/[slug]/config.ts` | 4 references |
| `src/pages/api/games/ten-up-one-down/session.ts` | 7 references |
| `src/pages/api/games/ten-up-one-down/session/round.ts` | 6 references |
| `src/pages/api/games/ten-up-one-down/session/round/last.ts` | 5 references |
| `src/pages/api/games/score-training/session.ts` | 7 references |
| `src/pages/api/games/score-training/session/round.ts` | 6 references |
| `src/pages/api/games/score-training/session/round/last.ts` | 4 references |
| `src/pages/api/games/score-training/session/complete.ts` | 5 references |
| `src/pages/api/games/singles-training/session.ts` | 7 references |
| `src/pages/api/games/singles-training/session/dart.ts` | 6 references |
| `src/pages/api/games/singles-training/session/dart/last.ts` | 4 references |
| `src/pages/api/games/singles-training/session/play-again.ts` | 5 references + rename local `username` param to `userId` |

### Test files — mock shape update

Replace `{ isLoggedIn, username?: string }` with `{ isLoggedIn, userId?: string }`. Use a stable test UUID (e.g. `00000000-0000-4000-8000-000000000001`) instead of `"alex"`.

| Test file | Notes |
|---|---|
| `tests/api/auth/login.test.ts` | Full rewrite — mock Neon proxy, not `session.save()` |
| `tests/api/auth/logout.test.ts` | Full rewrite — mock proxy `sign-out`, not `session.destroy()` |
| `tests/lib/server/auth/credentials.test.ts` | **Delete** |
| `tests/lib/server/auth/session.test.ts` | Rewrite for `AppSession` + proxy behavior |
| `tests/lib/client/alpine/forms/login.form.test.ts` | `username` → `email` in state and assertions |
| `tests/lib/shared/constants/errors.constants.test.ts` | Updated error copy |
| `tests/lib/shared/i18n/index.test.ts` | Updated error copy |
| `tests/middleware.test.ts` | Mock new `getSession(request)` |
| `tests/api/games/index.test.ts` | `userId` mock; rename "without username" test |
| `tests/api/games/config.test.ts` | `userId` mock; update `saveGameConfig` call args |
| `tests/api/games/ten-up-one-down/session.test.ts` | `authState.userId` |
| `tests/api/games/ten-up-one-down/round.test.ts` | mock `userId` |
| `tests/api/games/ten-up-one-down/round-last.test.ts` | mock `userId` |
| `tests/api/games/score-training/session.test.ts` | `authState.userId` |
| `tests/api/games/score-training/round.test.ts` | mock `userId` |
| `tests/api/games/score-training/round-last.test.ts` | mock `userId` |
| `tests/api/games/score-training/complete.test.ts` | mock `userId` |
| `tests/api/games/singles-training/session.test.ts` | `authState.userId` |
| `tests/api/games/singles-training/dart.test.ts` | mock `userId` |
| `tests/api/games/singles-training/dart-last.test.ts` | mock `userId` |
| `tests/api/games/singles-training/play-again.test.ts` | mock `userId` |
| `tests/pages/score-training-play-assembly.test.ts` | assert `session.userId` in source |
| `tests/pages/singles-training-play-assembly.test.ts` | assert `session.userId` / `auth.userId` |

---

## 6. Cleanup inventory

Everything that becomes obsolete during this migration. Implementation must remove or update all items — no dead code left behind.

### 6.1 Dependencies

| Package | Action |
|---|---|
| `iron-session` | **Remove** from `package.json` and lockfile |
| `@neondatabase/auth` | **Add** (`@latest`) |

`@neondatabase/serverless` stays — used for DB connectivity (separate from auth).

### 6.2 Environment variables

| Variable | Action |
|---|---|
| `AUTH_USERNAME` | **Remove** from `.env`, `.env.example`, Netlify dashboard, `vitest.config.ts` |
| `AUTH_PASSWORD` | **Remove** (same locations) |
| `SESSION_SECRET` | **Remove** (same locations) |
| `NEON_AUTH_BASE_URL` | Keep (already from `neonctl env pull`) |
| `NEON_AUTH_JWKS_URL` | Keep (may be used by future JWT validation; not required for proxy path) |
| `NEON_AUTH_COOKIE_SECRET` | **Add** — `openssl rand -base64 32`; required by `authApiHandler` |

### 6.3 Source files — delete

| File | Reason |
|---|---|
| `src/lib/server/auth/credentials.ts` | Env credential check replaced by Neon `sign-in/email` |
| `tests/lib/server/auth/credentials.test.ts` | Tests deleted module |

### 6.4 Source files — remove obsolete exports / code

| File | Obsolete code to remove |
|---|---|
| `src/lib/server/auth/session.ts` | `iron-session` import, `SessionData`, `sessionOptions`, `SESSION_MAX_AGE_SECONDS`, `getIronSession` call |
| `src/pages/api/auth/login.ts` | `assertAuthConfig`, `validateCredentials`, `session.save()`, `session.username = …` |
| `src/pages/api/auth/logout.ts` | `session.destroy()` |
| `src/lib/server/bootstrap-env.ts` | Early-return condition checking `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET` — replace with Neon auth env check or remove guard entirely |
| `src/lib/client/alpine/forms/login.form.ts` | `username` property and JSON field |
| `src/components/forms/LoginForm.astro` | `username` input id/name/label; replace with email field |

### 6.5 Scripts

| File | Action |
|---|---|
| `scripts/curl-verify-tuod.sh` | Replace `AUTH_USERNAME` / `AUTH_PASSWORD` env vars with `AUTH_EMAIL` / `AUTH_PASSWORD` (or read from a local test env file); update login POST body to `{ email, password }` |

### 6.6 Error messages & copy

| Location | Old | New |
|---|---|---|
| `errors.constants.ts` `INVALID_CREDENTIALS` | "Invalid username or password" | "Invalid email or password" |
| `errors.constants.ts` `MISSING_FIELDS` | "Username and password are required" | "Email and password are required" |
| `LoginForm.astro` label | "Username" | "Email" |

### 6.7 Cookies

| Cookie | Action |
|---|---|
| `dart-counter-session` | **No longer set** — browsers will stop receiving it after deploy; no server-side migration needed |

### 6.8 `getSession` call-site migration

Every caller currently passes `cookies` only. Update to pass `request`:

| Caller | New call |
|---|---|
| `middleware.ts` | `getSession(context.request)` |
| API routes (`*.ts`) | `getSession(request)` |
| Astro pages | `getSession(Astro.request)` |

**Count:** 21 call sites across 20 files (login route drops session mutation).

### 6.9 Documentation — update (not delete)

Historical plans remain for archaeology; update active context files so agents don't follow obsolete patterns.

| File | Action |
|---|---|
| `docs/superpowers/context/login-feature-context.md` | Rewrite auth section: Neon Auth, email login, `userId`, remove iron-session / env credentials |
| `docs/superpowers/context/logout-button-context.md` | Update session description: Neon Auth cookies, proxy logout |
| `docs/superpowers/specs/2026-06-13-login-design.md` | Add superseded banner at top pointing to this spec |
| `docs/superpowers/specs/2026-06-17-blobs-to-database-design.md` | Update § referencing `session.username` → `session.userId` (one line in schema table) |

**Not updated (historical):** `docs/superpowers/plans/2026-06-13-login.md` and other completed plan files — snapshots only.

### 6.10 Verification checklist (post-implementation)

Run before marking migration complete:

- [ ] `grep -r iron-session app/` returns zero hits (except lockfile until reinstall)
- [ ] `grep -r AUTH_USERNAME app/` returns zero hits
- [ ] `grep -r AUTH_PASSWORD app/` returns zero hits
- [ ] `grep -r SESSION_SECRET app/` returns zero hits
- [ ] `grep -r credentials.ts app/` returns zero hits
- [ ] `grep -r session\.username app/src` returns zero hits
- [ ] `grep -r auth\.username app/src` returns zero hits
- [ ] `npm test` passes
- [ ] `npm run check` passes
- [ ] Manual: login with seeded email → protected routes work → logout clears session

---

## 7. Flows

### Login

1. Alpine POST `{ email, password }` → `/api/auth/login`
2. Wrapper proxies to `sign-in/email` via `authApiHandler`
3. Success: forward all `Set-Cookie` headers → `{ ok: true }`
4. Failure: map Neon error → `INVALID_CREDENTIALS` / `MISSING_FIELDS`

### Logout

1. POST `/api/auth/logout` → proxy `sign-out` → forward cookie-clearing headers → `{ ok: true }`

### Middleware

Unchanged logic; only session source changes:

| Request | Action |
|---|---|
| `/login`, `/api/*`, static assets | Pass through |
| Authenticated + `/login` | Redirect to sanitized `redirect` or `/` |
| Unauthenticated + protected | Redirect to `/login?redirect=<path>` |
| Authenticated + protected | Continue |

---

## 8. User provisioning

1. Run `scripts/seed-neon-auth-user.ts` once (reads email/password from env or CLI args).
2. Script calls `sign-up/email` against `NEON_AUTH_BASE_URL`.
3. No signup UI in the app.
4. Verify user exists: `SELECT * FROM neon_auth."user";`

---

## 9. Error handling

| Case | Response |
|---|---|
| Missing email/password | `400` + `MISSING_FIELDS` |
| Bad credentials | `401` + `INVALID_CREDENTIALS` |
| Missing `NEON_AUTH_BASE_URL` or `NEON_AUTH_COOKIE_SECRET` | `500` + `SERVER_CONFIG` |
| Neon unreachable | `500` + `NETWORK_ERROR` |

---

## 10. Testing strategy

| Layer | Approach |
|---|---|
| `neon.ts` helpers | Unit test proxy path construction, Set-Cookie forwarding |
| `session.ts` | Mock `proxyAuthRequest` for `get-session` responses |
| `login.ts` / `logout.ts` | Mock proxy; assert cookie headers forwarded |
| `middleware.ts` | Mock `getSession` with `AppSession` shapes |
| Game API tests | Stable test `userId` UUID in mocks |
| `login.form.ts` | Email field and JSON body |

Optional manual/integration: login against real Neon branch in dev.

---

## 11. Out of scope

- Signup UI, OAuth providers, password-reset UI
- Migrating blob data from old `username` keys to Neon `user.id`
- Netlify Blobs → Neon Postgres (separate spec: `2026-06-17-blobs-to-database-design.md`)
- Account settings / password change UI
- Removing `@neondatabase/serverless` (database connectivity, not auth)

---

## 12. Netlify deployment

Add to Netlify environment (production + preview):

- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`
- `DATABASE_URL` (already present if DB work started)

Remove from Netlify:

- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `SESSION_SECRET`
