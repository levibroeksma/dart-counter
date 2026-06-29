# Neon Database Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each implementer subagent MUST also use superpowers:test-driven-development for code tasks and superpowers:verification-before-completion before claiming done. **Every task after Task 0 MUST pass the full Verification Gate** (static checks + `curl-verify-db.sh` with `npm run dev` running; Task 5+ also `curl-verify-tuod.sh`). **Task 6 is not DONE until `npx fallow dead-code` passes after manual triage** — see § Fallow Dead-Code Gate; never delete `app.factory.ts` (Alpine entrypoint in `astro.config.mjs`).

**Goal:** Replace all Netlify Blobs data storage with Neon Postgres (Drizzle ORM), keyed by Neon Auth `userId` (UUID). Clean start — no blob data migration.

**Architecture:** Hybrid schema — flat columns for preferences, catalog, play counts, and lifetime stats; `jsonb` for active game sessions. Data modules keep the same public API (except `getPreferences`/`setPreferences` gain `userId`). Runtime uses `drizzle-orm/neon-http` + `@neondatabase/serverless` (Netlify isolated serverless). Migrations use `drizzle-kit` with `DATABASE_URL_UNPOOLED`.

**Tech Stack:** Astro 6, `@astrojs/netlify`, `@neondatabase/serverless`, Drizzle ORM, TypeScript, Vitest

**Branch:** TBD  
**Spec:** `docs/superpowers/specs/2026-06-18-neon-database-migration-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

**Test constants (use everywhere):**
```typescript
export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
```

**Verification Gate (every task after Task 0):**

Static checks (CI-safe):
```
npm run check  →  npm test  →  npm run build
```

Dev runtime checks (catches Neon connection, env, SSR DB imports, and live query failures that static checks miss):
```
npm run dev  →  ./scripts/curl-verify-db.sh  [→  ./scripts/curl-verify-tuod.sh from Task 5]
```

One-liner (dev server must already be running — see § Dev Runtime Verification):
```bash
npm run check && npm test && npm run build && ./scripts/curl-verify-db.sh
```

From **Task 5** onward, also run the session smoke script:
```bash
npm run check && npm test && npm run build && ./scripts/curl-verify-db.sh && ./scripts/curl-verify-tuod.sh
```

**Fallow dead-code gate (Task 6 — required before DONE):**
```bash
npx fallow dead-code
```
See § Fallow Dead-Code Gate. **Never delete from fallow output without triage.**

**After schema changes:**
```
npm run db:generate  →  npm run db:migrate
```

---

## Dev Runtime Verification

`npm run check`, `npm test`, and `npm run build` do **not** execute SSR pages against a live Neon database. They miss:

- `DATABASE_URL` missing or wrong at module import (`db/index.ts` throws)
- Drizzle/neon-http query errors at request time
- Astro pages that call data modules during SSR (`settings.astro`, `index.astro`, `games/*.astro`)
- API routes that read/write Postgres with real auth cookies

### Prerequisites

| Requirement | Notes |
|---|---|
| `.env` in `app/` | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, Neon Auth vars (see `.env.example`) |
| Migrations applied | `npm run db:migrate` after schema changes |
| Seeded auth user | `npm run seed:auth` (or existing user) |
| Curl credentials | `AUTH_EMAIL` / `AUTH_PASSWORD` in env, or defaults `test@example.com` / `testpass` |

### Dev server protocol

**Terminal 1** (leave running):
```bash
cd app && npm run dev
```

Expected: `Local http://localhost:4321/` (default Astro port).

**Terminal 2** (verification):
```bash
cd app && ./scripts/curl-verify-db.sh
# Task 5+: also
./scripts/curl-verify-tuod.sh
```

**Background alternative** (agents):
```bash
cd app && npm run dev &
sleep 3
./scripts/curl-verify-db.sh
```

Stop the dev server when done. Do not report a task complete if curl scripts fail or return non-2xx.

### `scripts/curl-verify-db.sh`

Created in **Task 1**; extended in Tasks 2–5 as each data layer surface goes live.

| Task | Curl assertions added |
|---|---|
| 1 | Login; `GET /settings` SSR; `GET`/`PUT /api/settings/preferences` round-trip |
| 2 | `GET /games` — released catalog from DB (`Ten Up One Down`, `Score Training`) |
| 3 | `GET /` — Quick Start section renders game cards from DB-backed `getQuickStartGames` (e.g. `Ten Up One Down`) |
| 4 | No new assertions (stats written on game completion; covered in Task 5 via tuod flow) |
| 5 | `GET`/`PUT` game config API smoke; run full `./scripts/curl-verify-tuod.sh` (sessions + rounds) |
| 6 | Run both scripts as final gate |

**Task 0 only:** optional `curl -sf http://localhost:4321/login` after `npm run dev` — confirms dev starts before any DB routes are wired.

---

## Fallow Dead-Code Gate

Before the migration is **DONE**, run fallow to find stale code, unused exports, and unused types left over from the blob → Neon swap. Fallow has **false positives** — every finding must be triaged before deletion.

### Commands

| When | Command | Purpose |
|---|---|---|
| Task 6 (required) | `npx fallow dead-code` | Full dead-code report |
| Before deleting a file/export | `npx fallow dead-code --trace <path>[:<export>]` | Prove reachability (or confirm false positive) |
| After Task 6 fixes | `npx fallow dead-code` | Must exit 0 / no actionable findings |
| Optional per-task | `npx fallow audit --base HEAD` | Scope check on files changed in last commit |

Run from `app/`. Fallow auto-detects Astro/Vitest entry points via plugins — no config required for first run.

### Triage protocol (mandatory before any deletion)

For **each** unused file, export, or type fallow reports:

1. **Trace** — `npx fallow dead-code --trace <path>[:<symbol>]`
2. **Search** — `rg '<symbol>|<filename>'` across `app/` including config files
3. **Classify:**
   - **DELETE** — genuinely unreachable after migration (e.g. blob-only helper, orphaned mock)
   - **KEEP** — false positive (framework entrypoint, config reference, test-only import path)
   - **NARROW** — remove `export` keyword or delete unused type only; keep implementation
   - **SUPPRESS** — add `// fallow-ignore-next-line <rule>` with one-line reason (last resort)
4. **Re-verify** — full Verification Gate + `npx fallow dead-code` after changes

**Never use `fallow fix` without reviewing each change.** Auto-fix does not understand Astro config entrypoints.

### Known false positives in this project

Verify with trace + search, but these are **KEEP** unless proven otherwise:

| Finding | Why it is used |
|---|---|
| `src/lib/client/alpine/app.factory.ts` | Alpine entrypoint: `astro.config.mjs` → `alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" })` |
| `@neondatabase/serverless` | Runtime DB client (Task 0+); fallow flags before `db/index.ts` imports it |
| `prettier-plugin-astro`, `prettier-plugin-tailwindcss` | Prettier config plugins — not imported in TS |
| `@astrojs/alpinejs`, `@astrojs/netlify`, `@tailwindcss/vite` | Framework/build integrations in `astro.config.mjs` |
| `@icons/*.svg` | Vite/Astro path aliases — unlisted but resolved at build time |

### Expected post-migration cleanup targets

These **may** be safe to remove after blob migration — still triage each:

| Category | Examples to investigate |
|---|---|
| Blob-era dead code | Any remaining `@netlify/blobs` imports, blob mock helpers |
| Unused exports | `reconcileCatalog` if only used internally — drop `export`, don't delete function |
| Unused files | e.g. `DartCountPicker.astro` — confirm no Astro page imports before delete |
| Unused types | `DisplayNameMode`, `OpenOptions` — remove type export if truly private |

### Task 6 fallow workflow

```bash
npx fallow dead-code                          # 1. collect findings
npx fallow dead-code --trace <each-file>      # 2. triage every file finding
# 3. apply DELETE / NARROW / SUPPRESS decisions
npm run check && npm test && npm run build
./scripts/curl-verify-db.sh && ./scripts/curl-verify-tuod.sh
npx fallow dead-code                          # 4. must be clean (exit 0)
```

**DONE criteria:** Verification Gate passes **and** `npx fallow dead-code` reports no unresolved unused files/exports/types from this migration.

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `db/schema.ts` | Drizzle table definitions (all 7 tables) |
| `db/index.ts` | Neon HTTP Drizzle client singleton |
| `drizzle.config.ts` | Drizzle Kit config (`DATABASE_URL_UNPOOLED`) |
| `drizzle/migrations/*.sql` | Generated migration SQL |
| `tests/helpers/mock-db.ts` | Shared in-memory DB mock for unit tests |
| `tests/helpers/constants.ts` | `TEST_USER_ID` (add if not present) |
| `src/lib/server/data/preferences.ts` | Per-user preferences (Phase 1) |
| `src/lib/server/data/games.ts` | Catalog, play counts, config (Phases 2–3, 5) |
| `src/lib/server/data/player-*.ts` | Lifetime stats (Phase 4) |
| `src/lib/server/data/*-session.ts` | Active sessions (Phase 5) |
| `src/pages/api/settings/preferences.ts` | Pass `session.userId` to preferences |
| `src/pages/settings.astro` | Pass `session.userId` to `getPreferences` |
| `scripts/curl-verify-db.sh` | Dev runtime SSR/API smoke for DB-backed routes |

---

### Task 0: Bootstrap Drizzle + Neon Client

**Files:**
- Create: `app/db/schema.ts`
- Create: `app/db/index.ts`
- Create: `app/drizzle.config.ts`
- Modify: `app/package.json`
- Modify: `app/tsconfig.json` (path alias if needed)
- Modify: `app/vitest.config.ts` (path alias if needed)

- [ ] **Step 1: Install Drizzle**

Run from `app/`:
```bash
npm install drizzle-orm
npm install -D drizzle-kit
```

- [ ] **Step 2: Create `db/schema.ts`**

```typescript
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey(),
  displayName: varchar("display_name", { length: 20 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const gameCatalog = pgTable("game_catalog", {
  slug: varchar("slug", { length: 64 }).primaryKey(),
  displayName: varchar("display_name", { length: 128 }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  enabled: boolean("enabled").notNull(),
  released: boolean("released").notNull(),
});

export const userGamePlayCounts = pgTable(
  "user_game_play_counts",
  {
    userId: uuid("user_id").notNull(),
    gameSlug: varchar("game_slug", { length: 64 }).notNull(),
    playCount: integer("play_count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.gameSlug] })],
);

export const playerDartStats = pgTable("player_dart_stats", {
  userId: uuid("user_id").primaryKey(),
  doubleAttempts: integer("double_attempts").notNull().default(0),
  doubleHits: integer("double_hits").notNull().default(0),
  totalCheckouts: integer("total_checkouts").notNull().default(0),
  totalCheckoutDarts: integer("total_checkout_darts").notNull().default(0),
});

export const playerScoreTrainingStats = pgTable("player_score_training_stats", {
  userId: uuid("user_id").primaryKey(),
  gamesCompleted: integer("games_completed").notNull().default(0),
  totalDartsThrown: integer("total_darts_thrown").notNull().default(0),
  totalPointsScored: integer("total_points_scored").notNull().default(0),
  bestVisitScore: integer("best_visit_score").notNull().default(0),
  bestGameAverage: real("best_game_average").notNull().default(0),
});

export const playerSinglesTrainingStats = pgTable("player_singles_training_stats", {
  userId: uuid("user_id").primaryKey(),
  gamesCompleted: integer("games_completed").notNull().default(0),
  gamesFailed: integer("games_failed").notNull().default(0),
  totalDartsThrown: integer("total_darts_thrown").notNull().default(0),
  totalHits: integer("total_hits").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  dartPositionHits: integer("dart_position_hits").array().notNull().default([0, 0, 0]),
  dartPositionAttempts: integer("dart_position_attempts").array().notNull().default([0, 0, 0]),
  bestHitRatio: real("best_hit_ratio").notNull().default(0),
  bestScore: integer("best_score").notNull().default(0),
});

export const gameSessions = pgTable(
  "game_sessions",
  {
    userId: uuid("user_id").notNull(),
    gameSlug: varchar("game_slug", { length: 64 }).notNull(),
    sessionData: jsonb("session_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.gameSlug] })],
);
```

- [ ] **Step 3: Create `db/index.ts`**

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(connectionString);
export const db = drizzle({ client: sql, schema });
export * from "./schema";
```

- [ ] **Step 4: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 5: Add npm scripts to `package.json`**

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 6: Ensure `@db` path alias resolves**

In `tsconfig.json` paths (match existing `@lib` pattern):
```json
"@db/*": ["./db/*"]
```

Add same alias to `vitest.config.ts` `resolve.alias` if Vitest cannot resolve `@db`.

- [ ] **Step 7: Generate and apply initial migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: `drizzle/migrations/` contains SQL creating all 7 tables.

- [ ] **Step 8: Verify (static only — no DB routes wired yet)**

```bash
npm run check
npm test
npm run build
```

Optional dev smoke:
```bash
npm run dev &
sleep 3
curl -sf http://localhost:4321/login | grep -q "login"
```

- [ ] **Step 9: Commit**

```bash
git add db/ drizzle/ drizzle.config.ts package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "feat(db): bootstrap Drizzle schema and Neon client"
```

---

### Task 1: Migrate Preferences

**Files:**
- Create: `app/tests/helpers/mock-db.ts`
- Create: `app/tests/helpers/constants.ts` (if missing)
- Create: `app/scripts/curl-verify-db.sh`
- Modify: `app/src/lib/server/data/preferences.ts`
- Modify: `app/tests/lib/server/data/preferences.test.ts`
- Modify: `app/src/pages/api/settings/preferences.ts`
- Modify: `app/src/pages/settings.astro`

- [ ] **Step 1: Create `tests/helpers/constants.ts`**

```typescript
export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
```

- [ ] **Step 2: Create minimal `tests/helpers/mock-db.ts`**

Start with `userPreferences` table support only; extend in later tasks.

```typescript
import { vi } from "vitest";
import type { userPreferences } from "@db/schema";

type UserPreferencesRow = typeof userPreferences.$inferSelect;

const tables = {
  userPreferences: new Map<string, UserPreferencesRow>(),
};

export const mockDb = {
  tables,
  reset() {
    tables.userPreferences.clear();
  },
};

vi.mock("@db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(async () => {
          if (table === (await import("@db/schema")).userPreferences) {
            return [...mockDb.tables.userPreferences.values()];
          }
          return [];
        }),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((row: UserPreferencesRow) => ({
        onConflictDoUpdate: vi.fn(async () => {
          if (table === (await import("@db/schema")).userPreferences) {
            mockDb.tables.userPreferences.set(row.userId, row);
          }
        }),
      })),
    })),
  },
}));
```

Refine the mock during implementation so `preferences.ts` queries work with filtered `where(eq(...))` — the mock must return the row for the requested `userId` only.

- [ ] **Step 3: Update failing preferences tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb } from "@tests/helpers/mock-db";
import { TEST_USER_ID } from "@tests/helpers/constants";
import { getPreferences, setPreferences } from "@lib/server/data/preferences";

describe("preferences", () => {
  beforeEach(() => mockDb.reset());

  it("returns empty object when row is missing", async () => {
    await expect(getPreferences(TEST_USER_ID)).resolves.toEqual({});
  });

  it("returns stored preferences", async () => {
    mockDb.tables.userPreferences.set(TEST_USER_ID, {
      userId: TEST_USER_ID,
      displayName: "Alex",
      updatedAt: new Date(),
    });
    await expect(getPreferences(TEST_USER_ID)).resolves.toEqual({ displayName: "Alex" });
  });

  it("writes preferences via upsert", async () => {
    await setPreferences(TEST_USER_ID, { displayName: "Alex" });
    const row = mockDb.tables.userPreferences.get(TEST_USER_ID);
    expect(row?.displayName).toBe("Alex");
  });

  it("writes empty object when clearing display name", async () => {
    await setPreferences(TEST_USER_ID, {});
    const row = mockDb.tables.userPreferences.get(TEST_USER_ID);
    expect(row?.displayName).toBeNull();
  });
});
```

Run: `npm test tests/lib/server/data/preferences.test.ts`  
Expected: FAIL

- [ ] **Step 4: Rewrite `preferences.ts`**

```typescript
import { eq } from "drizzle-orm";
import { db, userPreferences } from "@db/index";

export type UserPreferences = {
  displayName?: string;
};

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row?.displayName) return {};
  return { displayName: row.displayName };
}

export async function setPreferences(
  userId: string,
  prefs: UserPreferences,
): Promise<void> {
  await db
    .insert(userPreferences)
    .values({
      userId,
      displayName: prefs.displayName ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        displayName: prefs.displayName ?? null,
        updatedAt: new Date(),
      },
    });
}
```

- [ ] **Step 5: Update callers**

`src/pages/api/settings/preferences.ts` — pass `session.userId!`:
```typescript
const prefs = await getPreferences(session.userId!);
// ...
await setPreferences(session.userId!, prefs);
```

`src/pages/settings.astro`:
```typescript
import { getSession } from "@lib/server/auth/session";

const session = await getSession(Astro.request);
let initialDisplayName = "";
if (session.isLoggedIn && session.userId) {
  const prefs = await getPreferences(session.userId);
  initialDisplayName = prefs.displayName ?? "";
}
```

- [ ] **Step 6: Create `scripts/curl-verify-db.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4321}"
EMAIL="${AUTH_EMAIL:-test@example.com}"
PASS="${AUTH_PASSWORD:-testpass}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

assert_contains() {
  local haystack="$1" needle="$2" label="$3"
  if ! printf '%s' "$haystack" | grep -q "$needle"; then
    echo "FAIL: $label — expected substring: $needle"
    exit 1
  fi
  echo "PASS: $label"
}

login() {
  curl -sf -c "$JAR" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > /dev/null
}

login
echo "Logged in"

SETTINGS_HTML=$(curl -sf -b "$JAR" -L "$BASE_URL/settings")
assert_contains "$SETTINGS_HTML" "displayNameSetting" "settings page SSR"

PREFS_GET=$(curl -sf -b "$JAR" "$BASE_URL/api/settings/preferences")
assert_contains "$PREFS_GET" '"ok":true' "preferences GET"

PREFS_PUT=$(curl -sf -b "$JAR" -X PUT "$BASE_URL/api/settings/preferences" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"CurlTest"}')
assert_contains "$PREFS_PUT" '"displayName":"CurlTest"' "preferences PUT"

PREFS_ROUNDTRIP=$(curl -sf -b "$JAR" "$BASE_URL/api/settings/preferences")
assert_contains "$PREFS_ROUNDTRIP" '"displayName":"CurlTest"' "preferences round-trip"

echo "All curl-verify-db checks passed"
```

```bash
chmod +x app/scripts/curl-verify-db.sh
```

- [ ] **Step 7: Run full Verification Gate**

Terminal 1: `npm run dev`  
Terminal 2:
```bash
npm run check && npm test && npm run build && ./scripts/curl-verify-db.sh
```

Expected: all pass; settings page and preferences API hit live Neon.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/data/preferences.ts tests/ src/pages/ scripts/curl-verify-db.sh
git commit -m "feat(db): migrate preferences to Neon Postgres"
```

---

### Task 2: Migrate Game Catalog

**Files:**
- Modify: `app/drizzle/migrations/` (seed DML migration)
- Modify: `app/src/lib/server/data/games.ts` (catalog functions only)
- Modify: `app/tests/lib/server/data/games.test.ts` (catalog tests only)
- Modify: `app/tests/helpers/mock-db.ts` (add `gameCatalog`)

- [ ] **Step 1: Add seed migration for `game_catalog`**

Create `drizzle/migrations/XXXX_seed_game_catalog.sql` (or add to a new generated migration) with INSERTs from `SEED_GAMES`:

```sql
INSERT INTO game_catalog (slug, display_name, sort_order, enabled, released) VALUES
  ('501', '501', 1, true, false),
  ('ten-up-one-down', 'Ten Up One Down', 2, true, true),
  ('121', '121', 3, true, false),
  ('score-training', 'Score Training', 4, true, true),
  ('singles-training', 'Singles Training', 5, true, true)
ON CONFLICT (slug) DO NOTHING;
```

Run: `npm run db:migrate`

- [ ] **Step 2: Extend `mock-db.ts` with `gameCatalog` Map**

- [ ] **Step 3: Rewrite catalog functions in `games.ts`**

Replace `readCatalog`, `getGameTypes`, `getGameBySlug` blob I/O with:

```typescript
import { eq } from "drizzle-orm";
import { db, gameCatalog } from "@db/index";

async function readCatalog(): Promise<GameType[]> {
  const rows = await db.select().from(gameCatalog);
  const stored: GameType[] = rows.map((row) => ({
    slug: row.slug,
    displayName: row.displayName,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    released: row.released,
  }));

  if (stored.length === 0) {
    await db.insert(gameCatalog).values(
      SEED_GAMES.map((g) => ({
        slug: g.slug,
        displayName: g.displayName,
        sortOrder: g.sortOrder,
        enabled: g.enabled,
        released: g.released,
      })),
    );
    return SEED_GAMES;
  }

  const merged = reconcileCatalog(stored);
  // Upsert reconciled seed entries back to DB if changed
  for (const game of merged) {
    await db
      .insert(gameCatalog)
      .values({
        slug: game.slug,
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
  return merged;
}
```

Keep `reconcileCatalog` unchanged. Leave play-count/session functions on blobs until Tasks 3 and 5.

- [ ] **Step 4: Update catalog-related tests** — replace blob mocks with `mockDb.tables.gameCatalog`

- [ ] **Step 5: Extend `curl-verify-db.sh` — catalog SSR**

Add after preferences checks:
```bash
GAMES_HTML=$(curl -sf -b "$JAR" -L "$BASE_URL/games")
assert_contains "$GAMES_HTML" "Ten Up One Down" "games page catalog from DB"
assert_contains "$GAMES_HTML" "Score Training" "games page includes score-training"
```

- [ ] **Step 6: Run full Verification Gate**

```bash
npm run check && npm test && npm run build && ./scripts/curl-verify-db.sh
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/data/games.ts tests/ scripts/curl-verify-db.sh drizzle/
git commit -m "feat(db): migrate game catalog to Neon Postgres"
```

---

### Task 3: Migrate Play Counts

**Files:**
- Modify: `app/src/lib/server/data/games.ts` (`getQuickStartGames`, `incrementPlayCount`)
- Modify: `app/tests/lib/server/data/games.test.ts`
- Modify: `app/tests/helpers/mock-db.ts`

- [ ] **Step 1: Extend mock-db for `userGamePlayCounts`**

- [ ] **Step 2: Rewrite `getQuickStartGames`**

```typescript
export async function getQuickStartGames(userId: string, limit: number): Promise<GameType[]> {
  const catalog = await getGameTypes();
  const rows = await db
    .select()
    .from(userGamePlayCounts)
    .where(eq(userGamePlayCounts.userId, userId));

  const playCounts: Record<string, number> = {};
  for (const row of rows) {
    playCounts[row.gameSlug] = row.playCount;
  }

  // ... existing ranking logic using playCounts map
}
```

- [ ] **Step 3: Rewrite `incrementPlayCount`**

```typescript
export async function incrementPlayCount(userId: string, slug: string): Promise<void> {
  await db
    .insert(userGamePlayCounts)
    .values({ userId, gameSlug: slug, playCount: 1 })
    .onConflictDoUpdate({
      target: [userGamePlayCounts.userId, userGamePlayCounts.gameSlug],
      set: { playCount: sql`${userGamePlayCounts.playCount} + 1` },
    });
}
```

Import `sql` from `drizzle-orm`.

- [ ] **Step 4: Extend `curl-verify-db.sh` — home Quick Start**

Add after games checks:
```bash
HOME_HTML=$(curl -sf -b "$JAR" -L "$BASE_URL/")
assert_contains "$HOME_HTML" "Quick Start" "home page SSR"
assert_contains "$HOME_HTML" "Ten Up One Down" "quick start games from DB"
```

- [ ] **Step 5: Run full Verification Gate**

```bash
npm run check && npm test && npm run build && ./scripts/curl-verify-db.sh
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/data/games.ts tests/ scripts/curl-verify-db.sh
git commit -m "feat(db): migrate play counts to Neon Postgres"
```

---

### Task 4: Migrate Lifetime Stats

**Files:**
- Modify: `app/src/lib/server/data/player-dart-stats.ts`
- Modify: `app/src/lib/server/data/player-score-training-stats.ts`
- Modify: `app/src/lib/server/data/player-singles-training-stats.ts`
- Modify: corresponding test files
- Modify: `app/tests/helpers/mock-db.ts`

- [ ] **Step 1: Extend mock-db for three stats tables**

- [ ] **Step 2: Rewrite `player-dart-stats.ts`**

Pattern for get/save:
```typescript
import { eq } from "drizzle-orm";
import { db, playerDartStats } from "@db/index";

export async function getPlayerDartStats(userId: string): Promise<PlayerDartStats> {
  const rows = await db
    .select()
    .from(playerDartStats)
    .where(eq(playerDartStats.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return createEmptyPlayerDartStats();
  return {
    doubleAttempts: row.doubleAttempts,
    doubleHits: row.doubleHits,
    totalCheckouts: row.totalCheckouts,
    totalCheckoutDarts: row.totalCheckoutDarts,
  };
}

export async function savePlayerDartStats(userId: string, stats: PlayerDartStats): Promise<void> {
  await db
    .insert(playerDartStats)
    .values({ userId, ...mapStatsToColumns(stats) })
    .onConflictDoUpdate({
      target: playerDartStats.userId,
      set: mapStatsToColumns(stats),
    });
}
```

- [ ] **Step 3: Apply same pattern to score-training and singles-training stats modules**

Map camelCase TS types ↔ snake_case columns. For `dartPositionHits`/`dartPositionAttempts`, store as `integer[]`.

- [ ] **Step 4: Update all three test files** — remove `@netlify/blobs` mocks

- [ ] **Step 5: Run full Verification Gate**

No new curl assertions — stats are persisted on game completion (exercised in Task 5 via `curl-verify-tuod.sh`).

```bash
npm run check && npm test && npm run build && ./scripts/curl-verify-db.sh
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/data/player-*.ts tests/
git commit -m "feat(db): migrate lifetime stats to Neon Postgres"
```

---

### Task 5: Migrate Game Sessions

**Files:**
- Modify: `app/src/lib/server/data/games.ts` (`saveGameConfig`, `getGameConfig`)
- Modify: `app/src/lib/server/data/ten-up-one-down-session.ts`
- Modify: `app/src/lib/server/data/score-training-session.ts`
- Modify: `app/src/lib/server/data/singles-training-session.ts`
- Modify: session test files (×3)
- Modify: `app/tests/helpers/mock-db.ts`

- [ ] **Step 1: Extend mock-db for `gameSessions`**

Key: `` `${userId}:${gameSlug}` ``

- [ ] **Step 2: Rewrite config functions in `games.ts`**

```typescript
export async function saveGameConfig(
  userId: string,
  slug: string,
  settings: Record<string, unknown>,
): Promise<GameConfig> {
  const config: GameConfig = {
    slug,
    settings,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(gameSessions)
    .values({
      userId,
      gameSlug: slug,
      sessionData: config,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [gameSessions.userId, gameSessions.gameSlug],
      set: { sessionData: config, updatedAt: new Date() },
    });
  return config;
}

export async function getGameConfig(userId: string, slug: string): Promise<GameConfig | null> {
  const rows = await db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.userId, userId), eq(gameSessions.gameSlug, slug)))
    .limit(1);
  const data = rows[0]?.sessionData;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (!record.settings || typeof record.settings !== "object") return null;
  return data as GameConfig;
}
```

- [ ] **Step 3: Rewrite each `*-session.ts` module**

Replace blob key `{userId}:{slug}` with `gameSessions` row keyed by `(userId, gameSlug)`. On read, run existing `is*Session()` guard on `sessionData`. On delete, `db.delete(gameSessions).where(...)`.

Example `saveScoreTrainingSession`:
```typescript
await db
  .insert(gameSessions)
  .values({
    userId,
    gameSlug: GAME_SLUG,
    sessionData: { ...session, updatedAt: new Date().toISOString() },
    updatedAt: new Date(),
  })
  .onConflictDoUpdate({
    target: [gameSessions.userId, gameSessions.gameSlug],
    set: {
      sessionData: { ...session, updatedAt: new Date().toISOString() },
      updatedAt: new Date(),
    },
  });
```

- [ ] **Step 4: Update session tests** — keep `is*Session` guard tests; replace blob mocks

- [ ] **Step 5: Extend `curl-verify-db.sh` — game config API**

Add after home checks:
```bash
ORIGIN_HEADER=(-H "Origin: $BASE_URL")
CONFIG_PUT=$(curl -sf -b "$JAR" -X PUT "$BASE_URL/api/games/ten-up-one-down/config" \
  "${ORIGIN_HEADER[@]}" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"endMode":"rounds","roundCount":10}}')
assert_contains "$CONFIG_PUT" '"ok":true' "game config PUT"

CONFIG_GET=$(curl -sf -b "$JAR" "$BASE_URL/api/games/ten-up-one-down/config")
assert_contains "$CONFIG_GET" '"roundCount":10' "game config GET round-trip"
```

- [ ] **Step 6: Run full Verification Gate + session smoke**

```bash
npm run check && npm test && npm run build && ./scripts/curl-verify-db.sh && ./scripts/curl-verify-tuod.sh
```

`curl-verify-tuod.sh` exercises session create, SSR embed, round POST/undo — catches `game_sessions` JSONB read/write at runtime.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/data/ tests/ scripts/curl-verify-db.sh
git commit -m "feat(db): migrate game sessions to Neon Postgres"
```

---

### Task 6: Cleanup

**Files:**
- Modify: `app/package.json`
- Delete: blob mocks from all test files (already replaced)
- Prior Netlify Database spec removed (superseded by this plan)
- Modify: any active context docs referencing blobs
- Triage/delete: fallow-reported stale files, exports, types (see § Fallow Dead-Code Gate)

- [ ] **Step 1: Confirm zero blob imports**

```bash
rg "@netlify/blobs" app/src app/tests
```

Expected: no matches

- [ ] **Step 2: Remove dependency**

```bash
npm uninstall @netlify/blobs
```

- [ ] **Step 3: Run fallow and triage every finding**

```bash
npx fallow dead-code
```

For each unused **file**:
```bash
npx fallow dead-code --trace src/path/to/file.ts
rg 'filename|symbol' .
```

**Mandatory check — `app.factory.ts`:** fallow reports this as unused. It is the Alpine entrypoint in `astro.config.mjs` line 14. **KEEP — do not delete.**

For each unused **export** or **type**: trace, then DELETE export / NARROW (remove `export`) / SUPPRESS — never delete the file without Step 3 trace confirming it is unreachable.

Document triage in commit message or PR notes (e.g. "kept app.factory.ts — astro entrypoint").

- [ ] **Step 4: Apply approved deletions**

Only files/exports/types classified **DELETE** or **NARROW** in Step 3. Examples of safe patterns after migration:
- Remove `export` from `reconcileCatalog` if only used inside `games.ts`
- Delete `DartCountPicker.astro` only if `rg DartCountPicker` shows zero imports
- Remove blob-specific test helpers if no longer referenced

- [ ] **Step 5: Final Verification Gate + fallow**

```bash
npm run check && npm test && npm run build && ./scripts/curl-verify-db.sh && ./scripts/curl-verify-tuod.sh
npx fallow dead-code
```

Expected: all commands pass; fallow exit 0 with no unresolved migration-related dead code.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(db): remove Netlify Blobs and triage fallow dead-code findings"
```

---

## Self-Review Checklist

| Spec requirement | Task |
|---|---|
| Hybrid schema (Approach A) | Task 0 |
| Clean start | No migration script tasks |
| `uuid` user_id | Task 0 schema |
| neon-http runtime driver | Task 0 `db/index.ts` |
| Preferences per-user fix | Task 1 |
| Catalog seed + reconcile | Task 2 |
| Play counts normalized | Task 3 |
| Three stats tables | Task 4 |
| Sessions as JSONB | Task 5 |
| Remove blobs | Task 6 |
| Unit test mock strategy | Tasks 1–5 `mock-db.ts` |
| Dev runtime verification | § Dev Runtime Verification; `curl-verify-db.sh` Tasks 1–5 |
| Session + stats runtime smoke | Task 5+ `curl-verify-tuod.sh` |
| Fallow dead-code gate | § Fallow Dead-Code Gate; Task 6 Steps 3–5 |
| DONE criteria | Verification Gate + `npx fallow dead-code` exit 0 |

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-18-neon-database-migration.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
