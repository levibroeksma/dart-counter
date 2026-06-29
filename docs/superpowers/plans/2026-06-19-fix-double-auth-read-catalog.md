# Fix Double Auth & readCatalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each implementer subagent MUST also use superpowers:test-driven-development for code tasks and superpowers:verification-before-completion before claiming done.

**Goal:** Eliminate duplicate Neon Auth HTTP calls on SSR page navigations and stop `readCatalog()` from writing to Postgres on every read.

**Architecture:** Middleware validates auth once per request and stores the result on `context.locals.session`. Astro pages read `Astro.locals.session` instead of calling `getSession()` again. API routes keep calling `getSession(request)` — they skip auth middleware and remain unchanged. `readCatalog()` becomes SELECT + in-memory merge with `SEED_GAMES` only; catalog upserts move to `scripts/db-migrate.ts` so they run at deploy/migrate time, not per page view.

**Tech Stack:** Astro 6, `@astrojs/netlify`, TypeScript, Vitest, Drizzle ORM, `@neondatabase/serverless` (HTTP driver)

**Branch:** `performance-optimizations` (or dedicated worktree)  
**Working directory:** `app/` (all commands run from here unless noted)  
**Performance context:** Production logs show `getSession` ≈ 110–195ms warm / 1.2s cold per call; pages currently call it twice. `readCatalog()` runs 1 SELECT + 5 sequential upserts per catalog read.

**Verification order (every task after Task 1):**

```
npm run check  →  npm test  →  npm run build
```

**Out of scope:** API route auth (already single-call), hosting migration, View Transitions, removing debug `console.time` instrumentation.

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `app/src/env.d.ts` | **Create.** Extend `App.Locals` with `session?: AppSession` |
| `app/src/middleware.ts` | **Modify.** Set `context.locals.session` after auth check |
| `app/tests/middleware.test.ts` | **Modify.** Assert `locals.session` is populated |
| `app/src/pages/index.astro` | **Modify.** Use `Astro.locals.session` |
| `app/src/pages/settings.astro` | **Modify.** Use `Astro.locals.session` |
| `app/src/pages/games/[game].astro` | **Modify.** Use `Astro.locals.session` |
| `app/src/pages/games/settings-[game].astro` | **Modify.** Single `locals.session` read, remove 3× `getSession` |
| `app/src/lib/server/data/games.ts` | **Modify.** `readCatalog()` read-only (no inserts/upserts) |
| `app/scripts/db-migrate.ts` | **Modify.** Upsert `SEED_GAMES` after migrations |
| `app/tests/lib/server/data/games.test.ts` | **Modify.** Expect in-memory merge, not DB writes on read |
| `app/tests/scripts/db-migrate.test.ts` | **Create.** Test catalog seed helper (unit-level, no DB) |

**Unchanged:** `session.ts`, `neon.ts`, `neon-proxy.ts`, all `src/pages/api/**` routes (they remain public-path + self-auth).

---

### Task 1: Type `App.Locals.session`

**Files:**
- Create: `app/src/env.d.ts`

- [ ] **Step 1: Create env.d.ts**

```typescript
/// <reference types="astro/client" />

type AppSession = import("@lib/server/auth/neon").AppSession;

declare namespace App {
  interface Locals {
    /** Set by middleware after auth validation on protected routes. */
    session?: AppSession;
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd app && npm run check`  
Expected: PASS (0 errors)

- [ ] **Step 3: Commit**

```bash
git add app/src/env.d.ts
git commit -m "chore: type App.Locals.session for middleware auth"
```

---

### Task 2: Middleware Stores Session in Locals

**Files:**
- Modify: `app/src/middleware.ts`
- Modify: `app/tests/middleware.test.ts`

- [ ] **Step 1: Write failing test for locals.session**

Add to `app/tests/middleware.test.ts`:

```typescript
import { getSession } from "@lib/server/auth/session";

// Add after existing vi.mock for session:
const mockGetSession = vi.mocked(getSession);

// Replace createContext with:
function createContext(pathname: string, search = "") {
  const locals: App.Locals = {};
  return {
    url: new URL(`http://localhost${pathname}${search}`),
    request: new Request(`http://localhost${pathname}${search}`),
    redirect: mockRedirect,
    locals,
  };
}

// Add new test inside describe("middleware"):
it("stores session on locals for logged-in protected routes", async () => {
  sessionLoggedIn = true;
  mockGetSession.mockResolvedValue({
    isLoggedIn: true,
    userId: "user-123",
    email: "a@b.com",
    name: "Alex",
  });

  const ctx = createContext("/games");
  await onRequest(ctx as never, mockNext);

  expect(mockGetSession).toHaveBeenCalledOnce();
  expect(ctx.locals.session).toEqual({
    isLoggedIn: true,
    userId: "user-123",
    email: "a@b.com",
    name: "Alex",
  });
  expect(mockNext).toHaveBeenCalled();
});

it("does not call next when unauthenticated on protected routes", async () => {
  mockGetSession.mockResolvedValue({ isLoggedIn: false });

  const ctx = createContext("/");
  await onRequest(ctx as never, mockNext);

  expect(ctx.locals.session).toBeUndefined();
  expect(mockRedirect).toHaveBeenCalledWith("/login?redirect=%2F");
});
```

Also update `beforeEach` to reset the mock:

```typescript
beforeEach(() => {
  sessionLoggedIn = false;
  mockNext.mockClear();
  mockRedirect.mockClear();
  mockGetSession.mockReset();
  mockGetSession.mockImplementation(async () => ({ isLoggedIn: sessionLoggedIn }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/middleware.test.ts -v`  
Expected: FAIL — `ctx.locals.session` is `undefined`

- [ ] **Step 3: Implement middleware locals assignment**

Replace `app/src/middleware.ts` with:

```typescript
import { defineMiddleware } from "astro:middleware";
import { getSession } from "@lib/server/auth/session";
import { sanitizeRedirect } from "@lib/shared/utils/redirect";

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_astro/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/api/");
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, searchParams } = context.url;

  if (isPublicPath(pathname) || isStaticAsset(pathname)) {
    if (pathname === "/login") {
      const session = await getSession(context.request);
      if (session.isLoggedIn) {
        const redirect = sanitizeRedirect(searchParams.get("redirect"));
        return context.redirect(redirect);
      }
    }
    return next();
  }

  const session = await getSession(context.request);
  if (!session.isLoggedIn) {
    const redirect = encodeURIComponent(pathname);
    return context.redirect(`/login?redirect=${redirect}`);
  }

  context.locals.session = session;
  return next();
});
```

Note: debug `console.time` calls are removed here — they caused label collisions in production logs and are replaced by this structural fix.

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/middleware.test.ts -v`  
Expected: PASS (all middleware tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/middleware.ts app/tests/middleware.test.ts
git commit -m "fix: store validated session on context.locals in middleware"
```

---

### Task 3: Migrate SSR Pages to `Astro.locals.session`

**Files:**
- Modify: `app/src/pages/index.astro`
- Modify: `app/src/pages/settings.astro`
- Modify: `app/src/pages/games/[game].astro`
- Modify: `app/src/pages/games/settings-[game].astro`

- [ ] **Step 1: Update `index.astro`**

Replace frontmatter imports and session fetch:

```astro
---
import AppLayout from "@layouts/AppLayout.astro";
import Card from "@components/ui/Card.astro";
import GameCard from "@components/games/GameCard.astro";
import { getQuickStartGames } from "@lib/server/data/games";
import type { GameType } from "@lib/shared/games/types";

const session = Astro.locals.session!;
let quickStartGames: GameType[] = [];

if (session.userId) {
  try {
    quickStartGames = await getQuickStartGames(session.userId, 2);
  } catch {
    quickStartGames = [];
  }
}
---
```

Remove: `import { getSession } from "@lib/server/auth/session";`  
Remove: `const session = await getSession(Astro.request);`

- [ ] **Step 2: Update `settings.astro`**

```astro
---
import AppLayout from "@layouts/AppLayout.astro";
import DisplayNameSetting from "@components/settings/DisplayNameSetting.astro";
import { getPreferences } from "@lib/server/data/preferences";

const session = Astro.locals.session!;
let initialDisplayName = "";
if (session.userId) {
  const prefs = await getPreferences(session.userId);
  initialDisplayName = prefs.displayName ?? "";
}
---
```

- [ ] **Step 3: Update `games/[game].astro`**

Replace session block (keep game/session DB logic):

```astro
const session = Astro.locals.session!;

if (session.userId) {
  try {
    await incrementPlayCount(session.userId, slug);
  } catch {
    // Non-fatal for prototype
  }
}

const tenUpOneDownSession =
  slug === "ten-up-one-down" && session.userId
    ? await getTenUpOneDownSession(session.userId)
    : null;

const scoreTrainingSession =
  slug === "score-training" && session.userId
    ? await getScoreTrainingSession(session.userId)
    : null;

const singlesTrainingSession =
  slug === "singles-training" && session.userId
    ? await getSinglesTrainingSession(session.userId)
    : null;
```

Remove `getSession` import and `await getSession(Astro.request)`.

- [ ] **Step 4: Update `games/settings-[game].astro`**

Replace the three `getSession` branches with one session read:

```astro
const session = Astro.locals.session!;
const SettingsForm = getSettingsFormComponent(slug)!;
let hasActiveSession = false;

if (slug === "ten-up-one-down" && session.userId) {
  const activeSession = await getTenUpOneDownSession(session.userId);
  hasActiveSession = isTenUpOneDownSession(activeSession);
} else if (slug === "score-training" && session.userId) {
  const activeSession = await getScoreTrainingSession(session.userId);
  hasActiveSession = isScoreTrainingSession(activeSession);
} else if (slug === "singles-training" && session.userId) {
  const activeSession = await getSinglesTrainingSession(session.userId);
  hasActiveSession = isSinglesTrainingSession(activeSession);
}
```

Remove `import { getSession } from "@lib/server/auth/session";`.

- [ ] **Step 5: Verify no SSR page still imports getSession**

Run: `cd app && rg "getSession" src/pages --glob '*.astro'`  
Expected: no matches (API routes under `src/pages/api/` are fine)

- [ ] **Step 6: Run full verification**

Run: `cd app && npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add app/src/pages/index.astro app/src/pages/settings.astro \
  app/src/pages/games/\[game\].astro app/src/pages/games/settings-\[game\].astro
git commit -m "fix: read session from Astro.locals instead of re-fetching auth"
```

---

### Task 4: Make `readCatalog()` Read-Only

**Files:**
- Modify: `app/src/lib/server/data/games.ts`
- Modify: `app/tests/lib/server/data/games.test.ts`

- [ ] **Step 1: Write failing test — no DB writes on read**

Replace these tests in `app/tests/lib/server/data/games.test.ts`:

**Replace** `"seeds catalog when store is empty"`:

```typescript
it("returns seed games when store is empty without writing catalog", async () => {
  const games = await getGameTypes();
  expect(games).toEqual(RELEASED_GAMES);
  expect(mockDb.tables.gameCatalog.size).toBe(0);
});
```

**Replace** `"reconciles stale catalog missing score-training"`:

```typescript
it("merges missing seed games in memory when catalog is stale", async () => {
  const staleCatalog = SEED_GAMES.filter((g) => g.slug !== "score-training");
  seedCatalog(staleCatalog);

  const games = await getGameTypes();

  expect(games.map((g) => g.slug)).toContain("score-training");
  expect(games).toEqual(RELEASED_GAMES);
  expect(mockDb.tables.gameCatalog.has("score-training")).toBe(false);
});
```

**Replace** `"reconciles stale catalog missing singles-training"`:

```typescript
it("merges missing singles-training in memory when catalog is stale", async () => {
  const staleCatalog = SEED_GAMES.filter((g) => g.slug !== "singles-training");
  seedCatalog(staleCatalog);

  const games = await getGameTypes();

  expect(games.map((g) => g.slug)).toContain("singles-training");
  expect(games).toEqual(RELEASED_GAMES);
  expect(mockDb.tables.gameCatalog.has("singles-training")).toBe(false);
});
```

**Replace** `"reconciliation is idempotent when catalog already matches seed"`:

```typescript
it("does not mutate catalog table on read when already seeded", async () => {
  seedCatalog();
  const before = [...mockDb.tables.gameCatalog.values()];

  await getGameTypes();

  const after = [...mockDb.tables.gameCatalog.values()];
  expect(after).toEqual(before);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/server/data/games.test.ts -v`  
Expected: FAIL on `"returns seed games when store is empty without writing catalog"` (catalog gets written today)

- [ ] **Step 3: Implement read-only readCatalog**

Replace `readCatalog` in `app/src/lib/server/data/games.ts`:

```typescript
async function readCatalog(): Promise<GameType[]> {
  const rows = await db
    .select()
    .from(gameCatalog)
    .where(eq(gameCatalog.entryEnv, CATALOG_ENTRY_ENV));

  const stored: GameType[] = rows.map((row) => ({
    slug: row.slug,
    displayName: row.displayName,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    released: row.released,
  }));

  return reconcileCatalog(stored);
}
```

Delete the empty-store insert block and the `for (const game of merged)` upsert loop entirely.

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/lib/server/data/games.test.ts -v`  
Expected: PASS (all games data layer tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/server/data/games.ts app/tests/lib/server/data/games.test.ts
git commit -m "perf: make readCatalog read-only with in-memory seed merge"
```

---

### Task 5: Seed Game Catalog in `db-migrate.ts`

**Files:**
- Create: `app/src/lib/server/data/seed-game-catalog.ts`
- Modify: `app/scripts/db-migrate.ts`
- Create: `app/tests/lib/server/data/seed-game-catalog.test.ts`

- [ ] **Step 1: Write failing test for seed helper**

Create `app/tests/lib/server/data/seed-game-catalog.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb } from "@tests/helpers/mock-db";
import { seedGameCatalog } from "@lib/server/data/seed-game-catalog";
import { SEED_GAMES } from "@lib/shared/games/types";
import { CATALOG_ENTRY_ENV } from "@lib/shared/constants/entry-env";

describe("seedGameCatalog", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("inserts all seed games when catalog is empty", async () => {
    await seedGameCatalog();

    expect(mockDb.tables.gameCatalog.size).toBe(SEED_GAMES.length);
    for (const game of SEED_GAMES) {
      expect(mockDb.tables.gameCatalog.get(game.slug)).toMatchObject({
        slug: game.slug,
        entryEnv: CATALOG_ENTRY_ENV,
        displayName: game.displayName,
        sortOrder: game.sortOrder,
        enabled: game.enabled,
        released: game.released,
      });
    }
  });

  it("upserts stale rows to match seed metadata", async () => {
    mockDb.tables.gameCatalog.set("score-training", {
      slug: "score-training",
      entryEnv: CATALOG_ENTRY_ENV,
      displayName: "Old Name",
      sortOrder: 99,
      enabled: false,
      released: false,
    });

    await seedGameCatalog();

    expect(mockDb.tables.gameCatalog.get("score-training")).toMatchObject({
      displayName: "Score Training",
      sortOrder: 4,
      enabled: true,
      released: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/server/data/seed-game-catalog.test.ts -v`  
Expected: FAIL — `seedGameCatalog` not defined

- [ ] **Step 3: Implement seedGameCatalog**

Create `app/src/lib/server/data/seed-game-catalog.ts`:

```typescript
import { db, gameCatalog } from "@db/index";
import { CATALOG_ENTRY_ENV } from "@lib/shared/constants/entry-env";
import { SEED_GAMES } from "@lib/shared/games/types";

/**
 * Upsert all SEED_GAMES into game_catalog. Run at migrate/deploy time, not during SSR.
 */
export async function seedGameCatalog(): Promise<void> {
  for (const game of SEED_GAMES) {
    await db
      .insert(gameCatalog)
      .values({
        slug: game.slug,
        entryEnv: CATALOG_ENTRY_ENV,
        displayName: game.displayName,
        sortOrder: game.sortOrder,
        enabled: game.enabled,
        released: game.released,
      })
      .onConflictDoUpdate({
        target: gameCatalog.slug,
        set: {
          displayName: game.displayName,
          sortOrder: game.sortOrder,
          enabled: game.enabled,
          released: game.released,
        },
      });
  }
}
```

- [ ] **Step 4: Run seed tests**

Run: `cd app && npm test -- tests/lib/server/data/seed-game-catalog.test.ts -v`  
Expected: PASS

- [ ] **Step 5: Call seedGameCatalog from db-migrate**

Add to `app/scripts/db-migrate.ts` after the migrate call:

```typescript
import { seedGameCatalog } from "../src/lib/server/data/seed-game-catalog";

// ... existing migrate call ...
await migrate(db, { migrationsFolder: "./drizzle/migrations" });

await seedGameCatalog();
console.log(`Seeded ${SEED_GAMES.length} game_catalog rows.`);
```

Add import at top:

```typescript
import { SEED_GAMES } from "../src/lib/shared/games/types";
```

- [ ] **Step 6: Run full verification**

Run: `cd app && npm run check && npm test && npm run build`  
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/server/data/seed-game-catalog.ts \
  app/scripts/db-migrate.ts \
  app/tests/lib/server/data/seed-game-catalog.test.ts
git commit -m "feat: seed game catalog during db migrate instead of SSR reads"
```

---

### Task 6: Post-Deploy Verification

**Files:** none (manual verification)

- [ ] **Step 1: Deploy to Netlify**

Run: `cd app && npm run deploy`  
Expected: deploy succeeds

- [ ] **Step 2: Confirm single auth call per SSR page**

Run two warm requests, then fetch function logs:

```bash
curl -s -o /dev/null "https://my-dart-counter.netlify.app/login"
curl -s -o /dev/null "https://my-dart-counter.netlify.app/games"
netlify logs --source functions --function ssr --since 5m
```

Expected (authenticated `/games` navigation after login): **one** `getSession` / `proxyNeonAuthUpstream` block per request, not two.

- [ ] **Step 3: Confirm catalog page DB reduction**

Load `/games` while logged in. In function logs, expect **no** repeated upsert activity from `readCatalog` (only SELECT-level DB work remains until separate DB timing is added).

- [ ] **Step 4: Run migrate against production DB (if not CI-automated)**

Run: `cd app && npm run db:migrate`  
Expected: `Seeded 5 game_catalog rows.` in output

---

## Self-Review Checklist

| Requirement | Task |
|---|---|
| Auth validated once in middleware | Task 2 |
| Session stored in `context.locals` | Task 2 |
| Pages reuse session, no duplicate HTTP proxy | Task 3 |
| API routes unchanged (still self-auth) | Out of scope — verified unchanged |
| `readCatalog()` read-only | Task 4 |
| Catalog writes moved to migrate/seed | Task 5 |
| Tests updated for new behavior | Tasks 2, 4, 5 |
| Production verification | Task 6 |

**Expected impact (warm, authenticated catalog page):**
- Auth: −1× `getSession` (~150ms)
- DB: −5× sequential upserts (~300–500ms)
- Total SSR savings: ~450–650ms before hosting changes
