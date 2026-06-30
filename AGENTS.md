# Agent Guide — Dart Counter

Conventions for AI agents and contributors. Application code lives in `app/`.

---

## Document strategy

This file is the **single source of truth** for repo conventions. Optimize for agent token cost:

| Do                                                 | Don't                                                      |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Read `AGENTS.md` first for patterns                | Re-read full design specs unless implementing that feature |
| Use tables/checklists here                         | Duplicate spec prose into agent context                    |
| Follow linked docs for feature-specific detail     | Inline historical plans or decision logs                   |
| Prefer barrel imports and layer boundaries         | Explore deep paths to infer conventions                    |
| Run verification + curl smoke before claiming done | Rely on unit tests alone for SSR/API wiring                |

**When editing this file:** tables over prose, action-oriented bullets, link `docs/superpowers/` for depth — don't copy specs.

---

## Stack

| Layer     | Choice                                                    |
| --------- | --------------------------------------------------------- |
| Framework | Astro 6 (`output: "server"`), Netlify adapter             |
| Client    | Alpine.js 3 + `@alpinejs/persist` via `@astrojs/alpinejs` |
| Styling   | Tailwind CSS 4                                            |
| DB        | Neon Postgres (`@neondatabase/serverless`) + Drizzle ORM  |
| Auth      | Neon Auth (proxied through app)                           |
| Tests     | Vitest + jsdom                                            |
| Node      | `>=22.12.0`                                               |

---

## Architecture

Three layers with strict boundaries:

```
lib/shared   — pure domain logic (no I/O)
lib/server   — auth, Drizzle data access, env bootstrap
lib/client   — Alpine factories/stores (UI state only; calls shared + API)
```

**Play flow:** settings validated server-side → session embedded in HTML → client holds in-progress state (`sessionStorage`) → server validates + persists only on completion.

**Data flow:** pages/API → `lib/server/data/*.ts` → `db/` (never call DB from shared or client).

**Identity:** `session.userId` (Neon UUID). Never use legacy `username` keys.

---

## Layout

```text
app/
├── db/                    # Drizzle schema + client
├── drizzle/migrations/
├── src/
│   ├── components/        # games/{slug}/, ui/, layout/, forms/
│   ├── icons/             # SVG (@icons/*)
│   ├── layouts/           # BaseLayout, AppLayout, GameLayout
│   ├── lib/
│   │   ├── client/alpine/ # app.factory.ts + per-feature factories
│   │   ├── server/        # auth/, data/
│   │   └── shared/        # games/, dartbot/, darts/, api/, i18n/, constants/
│   ├── pages/             # Astro routes + api/
│   ├── middleware.ts
│   └── styles/
└── tests/                 # mirrors src/ paths
```

---

## Path aliases (`app/tsconfig.json`)

| Alias           | Path               |
| --------------- | ------------------ |
| `@lib/*`        | `src/lib/*`        |
| `@components/*` | `src/components/*` |
| `@layouts/*`    | `src/layouts/*`    |
| `@styles/*`     | `src/styles/*`     |
| `@icons/*`      | `src/icons/*`      |
| `@db/*`         | `db/*`             |
| `@api/*`        | `src/pages/api/*`  |
| `@tests/*`      | `tests/*`          |

---

## `lib/shared` module structure

Every feature module under `app/src/lib/shared/`:

```text
<module>/
  types.ts      # stable domain types
  index.ts      # public barrel (types + functions + constants)
  *.ts          # logic files (private helpers stay unexported)
```

**Pilot barrels (ESLint enforced):** `games/501`, `games/score-training`, `games/singles-training`, `games/ten-up-one-down`, `dartbot`, `darts`, `stats`
**Rollout queue:** optional `games/index` aggregator only (deferred — `[game].astro` already uses per-game barrels)

Rollout handoff: `docs/superpowers/context/module-barrels-types-handoff.md`

### Type placement (hybrid)

| Location        | What                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `types.ts`      | Session, GameState, Settings, Summary, Stats, shared enums/unions                                           |
| With logic      | Function-coupled result types (`ValidateSettingsResult`, `ValidateCompletedResult`) — re-export from barrel |
| With guard impl | Type guards (`isFiveOhOneSession`) — re-export from barrel                                                  |

### Import rules

**External consumers** (pages, components, `lib/client`, `lib/server`, other shared modules) — barrel only:

```ts
import {
  buildFiveOhOneSession,
  type FiveOhOneSession,
} from "@lib/shared/games/501";
```

**Internal files** — relative siblings only (`./`). Never import own barrel or `@lib/shared/<module>/...` self-paths.

**Cross-module** — target module's barrel:

```ts
import { simulateVisit, type SimulatedVisit } from "@lib/shared/dartbot";
```

**ESLint:** `no-restricted-imports` blocks `@lib/shared/games/501/*`, `@lib/shared/dartbot/*`, `@lib/shared/darts/*`, `@lib/shared/stats/*`, and pilot game module deep paths. Exceptions: files inside those modules; private-symbol test files listed in `eslint.config.js`. `*.astro` excluded from lint.

### Barrel exports

Export: public types, factories, validators, constants needed outside.
Do **not** export: sibling-only helpers, subsystem internals (e.g. `dartbot/checkout/*`).

### New shared module checklist

1. `types.ts` + focused logic files + `index.ts` barrel
2. Migrate external consumers to barrel
3. Add ESLint boundary pattern
4. Update pilot list below + handoff doc
5. Verify (see § Verification)

---

## Game modules

### File roles (mirror `games/501`)

| File                                | Role                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `types.ts`                          | Domain types (when barrel complete)                                                       |
| `session.ts` / `session-factory.ts` | `build*Session`, `is*Session`                                                             |
| `form-data.ts`                      | Parse settings `FormData`                                                                 |
| `validation.ts`                     | `validate*Settings` → `{ valid: true, value }` \| `{ valid: false, code: MessageCode.* }` |
| `state.ts`                          | `apply*` / `revert*` moves                                                                |
| `completion.ts`                     | `validateCompleted*Session` for API                                                       |
| `summary.ts` / `stats.ts`           | End-game output + stat mutation                                                           |
| `constants.ts`                      | Domain bounds                                                                             |

Shared infra: `lib/shared/games/types.ts` (`SEED_GAMES`), `paths.ts`, `codes.ts`, `components.ts`.

### Dartbot simulation guardrails

| Topic       | Rule                                                                                                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Level cap   | Dartbot levels are `1-10` only; clamp/validate all external level input to this range.                                                                                                               |
| Throw model | Use weighted outcome distributions (`scoring-throw.ts`, `setup-throw.ts`, `double-throw.ts`) with convergence hit-shift adjustments; do not reintroduce route/miss engines.                          |
| File layout | Keep orchestration in `dart-bot.ts`/`throw-engine.ts`, profile math in `level-profiles.ts` + `interpolate-levels.ts`, and checkout routing in `checkout/*` (setup-zone planning only for `131-170`). |

### Client session pattern

All released games use client-authoritative play:

1. Settings → `POST` to `/games/{slug}` (or `PUT /api/games/{slug}/config` for generic shell)
2. Astro validates settings, builds session, passes JSON to Alpine via `x-data`
3. Alpine `$persist(...).as(key).using(sessionStorage)` — zero API calls during play
4. Completion → `POST /api/games/{slug}/complete` with `{ session }`
5. Play count incremented on completion (not page load) for client-session games

**Alpine wiring:** register in `lib/client/alpine/app.factory.ts`; escape session JSON (`replace(/</g, "\\u003c")`) before HTML injection.

**Loading UX:** static Astro skeleton shells until `ready: true`; summary skeleton during completion API.

### Completion API template

```ts
export const POST: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId)
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  // parse { session } wrapper or raw session
  const validated = validateCompleted * Session(sessionPayload);
  if (!validated.valid)
    return jsonResponse({ ok: false, code: validated.code }, 400);
  // buildSummary → applyGameCompletionToStats → save stats → incrementPlayCount
  return jsonResponse({ ok: true, summary }, 200);
};
```

Response types: `lib/shared/api/types.ts` (`ApiResponse` discriminated union).

### Add a new game

1. Add to `SEED_GAMES` in `lib/shared/games/types.ts`
2. Create `components/games/{slug}/SettingsForm.astro` + `Play.astro` (+ `Summary.astro` if needed)
3. Register in `lib/shared/games/components.ts`
4. Implement shared module (follow barrel pattern from start)
5. Add Alpine factories in `app.factory.ts`
6. Wire `[game].astro` POST handler + `api/games/{slug}/complete.ts`
7. Add server data module if stats table needed
8. Add tests (unit + API + play-assembly)

No new route files needed — dynamic `[game].astro` / `settings-[game].astro` dispatch by slug.

---

## Routing & pages

| Route                    | File                                | Purpose                          |
| ------------------------ | ----------------------------------- | -------------------------------- |
| `/games/{slug}`          | `pages/games/[game].astro`          | Play (per-slug POST + component) |
| `/games/settings-{slug}` | `pages/games/settings-[game].astro` | Settings                         |
| `/games`                 | `pages/games.astro`                 | Catalog                          |
| `/login`                 | `pages/login.astro`                 | Auth                             |

Path helpers: `settingsPath(slug)`, `playPath(slug)` in `lib/shared/games/paths.ts`.

**Validation:** `getGameBySlug(slug)` → unknown/disabled → redirect `/games?error=unknown-game`; no component → `unavailable-game`.

**Layouts:** `BaseLayout` (global chrome + `ConfirmationModal`), `AppLayout` (nav), `GameLayout` (play chrome).

**Middleware:** public = `/login`, `/api/*`, static assets; protected routes set `context.locals.session`.

**SSR data access:** pages call `lib/server/data/*` directly — not their own API routes.

---

## Alpine client

**Entry:** `lib/client/alpine/app.factory.ts` (referenced in `astro.config.mjs`). This is the **only** file that may import the Alpine runtime (`alpinejs`) or Alpine plugins (`@alpinejs/persist`, `@alpinejs/focus`, `@alpinejs/collapse`, etc.).

**Bootstrap rules:**

| Do | Don't |
| -- | ----- |
| Register plugins in `app.factory.ts` via `Alpine.plugin(...)` (e.g. `persist`, `effect`) | `import Alpine from "alpinejs"` in stores, data factories, or helpers |
| Pass the bootstrapped `Alpine` instance into store/data factories from `app.factory.ts` | `import persist from "@alpinejs/persist"` (or any `@alpinejs/*`) outside `app.factory.ts` |
| Use `import type { Alpine }` in factories when typing the injected instance | Instantiate or configure Alpine outside `app.factory.ts` |

**Patterns:**

- `Alpine.data("camelCaseName", factory)` for page controllers
- `Alpine.store("name", storeState(Alpine))` for global UI (e.g. `confirmationModal`)
- Factory returns state object with `init()` lifecycle
- Shared: `score-input.ts`, `dartbot-turn-modal.ts`, `game-settings.shell.ts`
- **`x-show` + `x-cloak`:** every Astro component or HTML element with `x-show` must also have `x-cloak` on the same element (prevents flash of hidden content before Alpine hydrates)

**Global confirmation modal:** `$store.confirmationModal.open({ title, message, onConfirm })` — mounted in `BaseLayout`.

---

## Components

```text
components/games/{slug}/
  SettingsForm.astro
  Play.astro
  Summary.astro          # optional
  *SettingsShell.astro   # optional per-game wrapper
```

Shared: `GamePlayShell`, `GameSettingsShell`, `GameCard`, `Toast`, `SummaryStatRow`.
UI primitives: `components/ui/` (`PrimaryBtn`, `Input`, `Skeleton`, `ConfirmationModal`, …).

Conventions: `interface Props` in frontmatter; Alpine directives in templates; icons from `@icons/*.svg`.

---

## Server data & DB

**Data layer:** `lib/server/data/*.ts` — stable function signatures; Drizzle implementation internal.

**Entry env:** all user tables use composite PK with `entry_env` (`dev`/`prod`). Queries via `withEntryEnv()`. Catalog always `prod` (`CATALOG_ENTRY_ENV`).

**Writes:** `insert … onConflictDoUpdate`. **Reads:** missing row → empty defaults / `createEmpty*Stats()` / `null`.

**DB client:** `db/index.ts` — pooled `DATABASE_URL` at runtime; `DATABASE_URL_UNPOOLED` for migrations.

**Scripts:** `db:generate`, `db:migrate`. Schema changes: commit migration SQL with schema.

**Dev branches:** `npm run dev` provisions Neon branch per git branch → `.env.local` → migrate → astro. Skip: `SKIP_NEON_DEV_BRANCH=1` or `CI=true`.

---

## Auth

- Neon Auth proxied via `lib/server/auth/neon-proxy.ts` (fetch-based; no Next.js SDK)
- `getSession(request: Request)` → `AppSession` (`isLoggedIn`, `userId?`, `email?`, `name?`)
- Routes: `/api/auth/login`, `/api/auth/logout`, `/api/auth/[...path]` catch-all
- Seed user: `npm run seed:auth`
- Env: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (≥32 chars), `DATABASE_URL`

---

## Testing

**Layout mirrors source:** `tests/lib/shared/...`, `tests/api/...`, `tests/lib/client/...`.

| Layer       | Pattern                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| Unit        | Import shared functions directly                                          |
| API         | Import `POST`/`GET` from `@api/...`; mock `getSession`, data layer        |
| Assembly    | Read Astro source; assert wiring strings (`x-data`, imports, form method) |
| Integration | e.g. confirmation modal store                                             |

**Mocks:** `tests/helpers/mock-db.ts` for Drizzle. Test `userId`: stable UUID (e.g. `00000000-0000-4000-8000-000000000001`).

**Config:** `vitest.config.ts` extends Astro Vite config; path aliases match tsconfig.

---

## i18n & errors

- `MessageCode` enum: `lib/shared/constants/errors.constants.ts`
- User-facing strings: `t(code)` in `lib/shared/i18n/index.ts`
- API errors: `{ ok: false, code: MessageCode.* }` — never ad-hoc strings

---

## Verification

### Static checks

```bash
cd app
npm run check
npm test
npx fallow   # catches false-unused (e.g. app.factory.ts via astro.config.mjs)
npm run lint
./scripts/audit-imports.sh   # deep-import guard for barrel modules (incl. *.astro)
```

After schema changes: `npm run db:migrate`.

**After pulling DB migrations:** run `cd app && npm run db:migrate` before local completion API smoke tests. Missing tables (e.g. `player_501_stats`) cause 500s; stale schema causes confusing play-flow failures.

### Curl smoke tests

Runtime SSR/API wiring — requires dev server (`npm run dev` in another terminal). Uses cookie jar login; defaults match `npm run seed:auth` / `DEV_AUTH_DEFAULTS` (`test@example.com` / `testpass`).

| Script                        | Covers                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `scripts/curl-verify-db.sh`   | Login, settings SSR, preferences API, games/home catalog, game config PUT/GET |
| `scripts/curl-verify-501.sh`  | 501 settings/play POST, Alpine embed, skeleton, `/api/games/501/complete`     |
| `scripts/curl-verify-tuod.sh` | TUOD settings→play POST, session embed, `/api/games/ten-up-one-down/complete` |

```bash
cd app
npm run dev   # separate terminal; provisions Neon dev branch + migrations

# DB + core routes
./scripts/curl-verify-db.sh

# Per-game (when touching that game)
./scripts/curl-verify-501.sh
./scripts/curl-verify-tuod.sh
```

**Env overrides:** `BASE_URL` (default `http://localhost:4321`), `AUTH_EMAIL`, `AUTH_PASSWORD`.

**Expected:** each script prints `PASS:` lines then `All curl checks passed` (or `All curl-verify-db checks passed`) and exits 0. Non-2xx or missing substrings = fail.

**Full gate** (before merge on DB/game changes):

```bash
cd app && npm run check && npm test && npm run lint && npx fallow \
  && ./scripts/audit-imports.sh \
  && ./scripts/curl-verify-db.sh \
  && ./scripts/curl-verify-tuod.sh
```

Add `./scripts/curl-verify-501.sh` when changing 501 play/completion.

---

## Related docs

| Topic                  | Path                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| Module barrels rollout | `docs/superpowers/context/module-barrels-types-handoff.md`                  |
| Module barrels design  | `docs/superpowers/specs/2026-06-30-module-barrels-types-design.md`          |
| Game routing           | `docs/superpowers/specs/2026-06-14-game-routing-design.md`                  |
| Client session pattern | `docs/superpowers/specs/2026-06-19-score-training-client-session-design.md` |
| Neon DB                | `docs/superpowers/specs/2026-06-18-neon-database-migration-design.md`       |
| Neon Auth              | `docs/superpowers/specs/2026-06-18-neon-auth-migration-design.md`           |
| Neon dev branches      | `docs/superpowers/specs/2026-06-19-neon-dev-branching-design.md`            |
| Feature specs/plans    | `docs/superpowers/specs/`, `docs/superpowers/plans/`                        |
