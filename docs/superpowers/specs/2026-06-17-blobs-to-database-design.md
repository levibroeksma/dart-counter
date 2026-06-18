# Blobs → Netlify Database Migration — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-17  
**Branch:** TBD  
**Scope:** Replace all Netlify Blobs usage in `app/src/lib/server/data/` with Netlify Database (Postgres via Drizzle ORM). No production data migration — clean start.

---

## 1. Overview

Dart Counter stores all dynamic app data via `@netlify/blobs` across 8 data modules and 6 blob stores. Original specs noted the data layer was swappable for a database later. This migration executes that swap using **Netlify Database** (GA Postgres) with **Drizzle ORM** (`@beta` dist-tag).

| Decision | Choice |
|---|---|
| Production data | Clean start — no blob → DB migration script |
| Schema shape | Hybrid — structured columns for scalars; `jsonb` for active game sessions |
| Rollout | Incremental — one store/module group per phase |
| ORM | Drizzle (`drizzle-orm@beta`, `drizzle-kit@beta`) |
| Blob package | Removed entirely at end (no file/asset storage in app) |

### Current blob stores

| Store | Key pattern | Data module(s) |
|---|---|---|
| `user-preferences` | `default` (global) | `preferences.ts` |
| `game-types` | `catalog` | `games.ts` |
| `user-game-stats` | `{userId}` | `games.ts` |
| `game-sessions` | `{userId}:{slug}` | `games.ts`, `*-session.ts` (×3) |
| `player-dart-stats` | `{userId}` | `player-dart-stats.ts` |
| `player-score-training-stats` | `{userId}` | `player-score-training-stats.ts` |
| `player-singles-training-stats` | `{userId}` | `player-singles-training-stats.ts` |

### Unchanged boundaries

- API routes (`src/pages/api/`)
- Astro pages (except preferences callers gaining `userId`)
- Shared types and validators (`lib/shared/`)
- Public exports of data modules (same function names; preferences gains `userId` param)

---

## 2. Architecture

```
┌─────────────────────────────────────────┐
│  API routes / Astro pages               │
└─────────────────┬───────────────────────┘
                  │ unchanged imports
┌─────────────────▼───────────────────────┐
│  lib/server/data/*.ts  (same exports)   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  db/index.ts  — drizzle({ schema })     │
│  db/schema.ts — Drizzle table defs      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  Netlify Database (Postgres)            │
│  migrations → netlify/database/migrations│
└─────────────────────────────────────────┘
```

### New files

| File | Purpose |
|---|---|
| `app/db/schema.ts` | All Drizzle table definitions |
| `app/db/index.ts` | `drizzle({ schema })` client via `drizzle-orm/netlify-db` |
| `app/drizzle.config.ts` | `out: "netlify/database/migrations"` |

### New dependencies

```bash
npm install @netlify/database drizzle-orm@beta
npm install -D drizzle-kit@beta
```

### New scripts (`package.json`)

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "netlify database migrations apply"
}
```

- `db:generate` — writes migration SQL from schema changes
- `db:migrate` — applies pending migrations to **local dev DB only**; deploy applies hosted DB automatically

### Migration rules (Netlify Database)

- Never run `drizzle-kit migrate` or `drizzle-kit push` against hosted DB
- Never run DDL via `netlify database connect` — schema changes go through migration files only
- Commit schema + migration file together; deploy applies to preview then production

---

## 3. Schema

Hybrid layout: typed columns where fields are flat/scalar; `jsonb` for large, frequently rewritten session documents.

### `user_preferences`

| Column | Type | Notes |
|---|---|---|
| `user_id` | `varchar` PK | `session.userId` |
| `display_name` | `varchar(20)` nullable | |
| `updated_at` | `timestamp` | default now |

**Fix:** Replaces global blob key `"default"` with per-user rows keyed by `session.username`.

### `game_catalog`

| Column | Type | Notes |
|---|---|---|
| `slug` | `varchar` PK | |
| `display_name` | `varchar` | |
| `sort_order` | `integer` | |
| `enabled` | `boolean` | |
| `released` | `boolean` | |

Seeded via DML migration from `SEED_GAMES` in `lib/shared/games/types.ts`. `reconcileCatalog()` behavior preserved on read: seed entries win on conflict; unknown stored entries preserved.

### `user_game_play_counts`

| Column | Type | Notes |
|---|---|---|
| `user_id` | `varchar` | composite PK with `game_slug` |
| `game_slug` | `varchar` | |
| `play_count` | `integer` | default 0 |

Replaces `user-game-stats` blob (`playCounts` map → rows).

### `player_dart_stats`

Flat columns matching `PlayerDartStats`:

| Column | Type |
|---|---|
| `user_id` | `varchar` PK |
| `double_attempts` | `integer` default 0 |
| `double_hits` | `integer` default 0 |
| `total_checkouts` | `integer` default 0 |
| `total_checkout_darts` | `integer` default 0 |

### `player_score_training_stats`

Flat columns matching `PlayerScoreTrainingStats`:

| Column | Type |
|---|---|
| `user_id` | `varchar` PK |
| `games_completed` | `integer` default 0 |
| `total_darts_thrown` | `integer` default 0 |
| `total_points_scored` | `integer` default 0 |
| `best_visit_score` | `integer` default 0 |
| `best_game_average` | `real` default 0 |

### `player_singles_training_stats`

| Column | Type |
|---|---|
| `user_id` | `varchar` PK |
| `games_completed` | `integer` default 0 |
| `games_failed` | `integer` default 0 |
| `total_darts_thrown` | `integer` default 0 |
| `total_hits` | `integer` default 0 |
| `total_score` | `integer` default 0 |
| `dart_position_hits` | `integer[3]` default `{0,0,0}` |
| `dart_position_attempts` | `integer[3]` default `{0,0,0}` |
| `best_hit_ratio` | `real` default 0 |
| `best_score` | `integer` default 0 |

### `game_sessions`

| Column | Type | Notes |
|---|---|---|
| `user_id` | `varchar` | composite PK with `game_slug` |
| `game_slug` | `varchar` | |
| `session_data` | `jsonb` | full session or config document |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

Covers:
- Active game sessions (ten-up-one-down, score-training, singles-training)
- Legacy `saveGameConfig` / `getGameConfig` (settings-only docs as `{ slug, settings, updatedAt }`)

**Indexes:** Primary keys only — low row count, no analytics queries yet.

---

## 4. Data layer API changes

### Preferences (breaking internal signature)

```typescript
// Before
getPreferences(): Promise<UserPreferences>
setPreferences(prefs: UserPreferences): Promise<void>

// After
getPreferences(userId: string): Promise<UserPreferences>
setPreferences(userId: string, prefs: UserPreferences): Promise<void>
```

Callers updated:
- `src/pages/api/settings/preferences.ts` — pass `session.userId`
- `src/pages/settings.astro` — call `getSession(Astro.request)` and pass `session.userId` (middleware already requires login for this route)

### All other modules

Public function signatures unchanged. Only internal implementation swaps blob I/O for Drizzle queries.

### Write pattern

Use Drizzle `insert … onConflictDoUpdate` (upsert) for all writes — preferences, stats, sessions, play counts. Avoids read-then-write races.

### Read pattern

| Missing row | Return value |
|---|---|
| Preferences | `{}` |
| Stats | `createEmpty*Stats()` factory |
| Session | `null` (after `is*Session()` guard on JSONB) |
| Play counts | `0` per slug |
| Catalog | Seed + reconcile |

---

## 5. Incremental migration phases

Seven PR-sized steps. Each: schema migration (if needed) → rewrite data module → update tests → verify.

| Phase | Scope | Blob store replaced |
|---|---|---|
| **0 — Bootstrap** | Install deps, `drizzle.config.ts`, `db/schema.ts`, `db/index.ts`, initial migration, scripts | — |
| **1 — Preferences** | `user_preferences` table; rewrite `preferences.ts`; update callers | `user-preferences` |
| **2 — Game catalog** | `game_catalog` table + seed DML; rewrite catalog functions in `games.ts` | `game-types` |
| **3 — Play counts** | `user_game_play_counts` table; rewrite `getQuickStartGames` + `incrementPlayCount` | `user-game-stats` |
| **4 — Lifetime stats** | Three stats tables; rewrite three `player-*-stats.ts` modules | 3 stats stores |
| **5 — Game sessions** | `game_sessions` table; rewrite three `*-session.ts` + config functions in `games.ts` | `game-sessions` |
| **6 — Cleanup** | Remove `@netlify/blobs`; delete blob mocks; shared `mock-db` test helper; update docs | all |

### Phase ordering rationale

1. **Preferences** — smallest module; validates full DB toolchain end-to-end
2. **Catalog** before play counts — `getQuickStartGames` needs catalog
3. **Stats** before sessions — session completion APIs write stats; stats layer stable first
4. **Cleanup** last — blobs remain as fallback until every module migrated

### Per-phase verification

```bash
npm test
npm run check
npm run db:migrate   # after schema changes, local only
```

---

## 6. Testing

| Layer | Approach |
|---|---|
| **Unit tests** | Replace `vi.mock("@netlify/blobs")` with mock of `db/index.ts`. Existing assertions unchanged. |
| **Shared helper** | `tests/helpers/mock-db.ts` — factory for in-memory mock handling select/insert/update/delete/upsert per table |
| **Integration** | Optional post-bootstrap smoke test against real local DB. Not required per phase. |

### Test files to update

- `tests/lib/server/data/preferences.test.ts`
- `tests/lib/server/data/games.test.ts`
- `tests/lib/server/data/player-dart-stats.test.ts`
- `tests/lib/server/data/score-training-session.test.ts`
- `tests/lib/server/data/ten-up-one-down-session.test.ts`
- `tests/lib/server/data/singles-training-session.test.ts`

---

## 7. Error handling

- Data modules let DB errors propagate to API routes (same as blob errors → 500)
- Missing rows return same defaults as today (see §4 Read pattern)
- JSONB session reads: keep existing `is*Session()` runtime guards
- No retry logic — Postgres transient failures surface as 500 (same as blobs)

---

## 8. Local development

- `netlify dev` runs against local Postgres-compatible DB
- Run `npm run db:migrate` after pulling schema changes (deploy does not auto-apply locally)
- `NETLIFY_DB_URL` provided by Netlify tooling — no `bootstrap-env.ts` changes
- Requires Netlify CLI 26.0.0+ for `netlify database` commands

---

## 9. Cleanup (Phase 6)

- Remove `@netlify/blobs` from `package.json`
- Remove all `vi.mock("@netlify/blobs")` from tests
- Update prior specs/plans that say "Netlify Blobs via data layer" (informational only)
- Do not retain `@netlify/blobs` for future file storage — use Blobs only if/when file uploads are added as a separate feature

---

## 10. Out of scope

- Blob → DB data migration script (no live production data)
- Dual-write or feature-flag cutover
- Normalizing session JSONB into relational dart/round tables
- Analytics queries or additional indexes
- Multi-user auth changes beyond per-user preferences fix
- Query history / audit logging

---

## 11. Approaches considered

| Approach | Verdict |
|---|---|
| **Drizzle hybrid schema** (chosen) | Type-safe, Netlify-native migration path, incremental module swap |
| Native driver + hand-written SQL | Rejected — more boilerplate, no schema-generated migrations |
| Storage abstraction layer (blob + DB) | Rejected — overkill with no live data and no dual-write need |
| Full JSONB (mirror blobs 1:1) | Rejected — misses query benefits for stats/play counts |
| Full normalization | Rejected — large refactor for session documents with no current query need |
