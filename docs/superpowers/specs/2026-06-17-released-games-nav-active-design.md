# Released Games & Bottom Nav Active State — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-17  
**Branch:** TBD  
**Scope:** Show only fully implemented games on `/games` and Quick Start; fix BottomNav active-tab highlighting

---

## 1. Overview

The `/games` page and home Quick Start section currently list every `enabled` game from the blob-backed catalog. That includes prototype placeholders (`501`, `121`) whose play UIs are stubs, while a stale catalog can omit newly added games (e.g. Score Training). BottomNav uses exact pathname matching, so nested game routes (`/games/score-training`, `/games/settings-ten-up-one-down`) do not highlight the Games tab. Active and inactive nav items also share a base `text-accent` class, weakening visual distinction.

**Goals:**

1. List only **released** (fully implemented) games: `ten-up-one-down`, `score-training`
2. Keep unreleased games (`501`, `121`) in the catalog for future use but hidden from lists and blocked at route lookup
3. Reconcile stale blob catalogs with `SEED_GAMES` so new games appear without manual blob resets
4. Highlight the Games nav tab on any `/games` path; fix active/inactive styling

**Non-goals:**

- Styling changes beyond active-state class logic in `NavBtn`
- Removing placeholder component files or registry entries for 501/121
- Admin UI for toggling `released` at runtime

---

## 2. Game visibility

### `released` flag

Extend `GameType`:

```ts
export type GameType = {
  slug: string;
  displayName: string;
  sortOrder: number;
  enabled: boolean;
  released: boolean;
};
```

Update `SEED_GAMES`:

| slug | released |
| ---- | -------- |
| `501` | `false` |
| `ten-up-one-down` | `true` |
| `121` | `false` |
| `score-training` | `true` |

All entries remain `enabled: true`. `released` controls user-facing visibility; `enabled` remains available for future hard-disable without deleting catalog entries.

### Catalog reconciliation

`readCatalog()` in `lib/server/data/games.ts` currently seeds once when the blob is empty. Add reconciliation when a catalog already exists:

1. Read stored catalog from blob
2. For each entry in `SEED_GAMES`, upsert by `slug` (add missing, update `displayName`, `sortOrder`, `enabled`, `released`)
3. Preserve any stored entries not in `SEED_GAMES` unchanged (forward-compatible)
4. If the merged result differs from stored, persist back to blob
5. Return merged catalog

This fixes dev/prod catalogs seeded before Score Training was added without wiping `user-game-stats` or `game-sessions`.

### Data layer filters

`getGameTypes()`:

```ts
catalog
  .filter((game) => game.enabled && game.released)
  .sort((a, b) => a.sortOrder - b.sortOrder);
```

`getGameBySlug(slug)`:

- Uses the same `enabled && released` filter via `getGameTypes()` (or equivalent internal helper)
- Returns `null` for unreleased slugs → existing pages redirect to `/games?error=unknown-game`

`getQuickStartGames(userId, limit)`:

- No signature change; ranking logic unchanged
- Input pool is already filtered to released games only
- Fallback (no play stats) returns first N **released** games by `sortOrder`

### Consumer impact

| Consumer | Change |
| -------- | ------ |
| `/games` (`games.astro`) | None — already maps `getGameTypes()` |
| Home Quick Start (`index.astro`) | None — already maps `getQuickStartGames()` |
| `settings-[game].astro` / `[game].astro` | Unreleased slugs fail `getGameBySlug` → existing redirect |
| `GET /api/games` | Returns released-only list automatically |

### Route validation (unchanged flow)

1. `getGameBySlug(slug)` — null if unreleased/disabled/unknown
2. `hasGameComponents(slug)` — still guards missing UI registry entries

Unreleased games with registered placeholder components are blocked at step 1, so users cannot reach placeholder play pages via URL.

---

## 3. BottomNav active state

### `NavBtn` matching

Add optional prop:

```ts
interface Props {
  href: string;
  matchPrefix?: string;
}
```

Active when:

```ts
const isActive =
  Astro.url.pathname === href ||
  (matchPrefix != null && Astro.url.pathname.startsWith(matchPrefix));
```

`BottomNav.astro`:

| Tab | `href` | `matchPrefix` |
| --- | ------ | ------------- |
| Home | `/` | — (exact only) |
| Games | `/games` | `/games` |
| Statistics | `/statistics` | — (exact only) |

Prefix match ensures `/games`, `/games/score-training`, and `/games/settings-ten-up-one-down` all highlight Games. Home stays exact so `/games` does not highlight Home.

### Active/inactive styling

Remove `text-accent` from the shared base class string. Apply conditionally:

- **Active:** base classes + `text-accent`
- **Inactive:** base classes + `nav-link-inactive` (`text-text-muted`)

This makes inactive icons clearly muted; active icons use accent color.

---

## 4. Files to change

| File | Change |
| ---- | ------ |
| `src/lib/shared/games/types.ts` | Add `released` to `GameType`; update `SEED_GAMES` |
| `src/lib/server/data/games.ts` | `reconcileCatalog()`; filter `released` in getters |
| `src/components/layout/NavBtn.astro` | `matchPrefix` prop; conditional active classes |
| `src/components/layout/BottomNav.astro` | `matchPrefix="/games"` on Games `NavBtn` |
| `tests/lib/shared/games/types.test.ts` | Assert `released` on seed entries |
| `tests/lib/server/data/games.test.ts` | Reconciliation, released filter, quick-start pool |
| New: `tests/lib/shared/nav/is-nav-active.test.ts` (or inline NavBtn test) | Prefix + exact match logic |

No changes to `games.astro`, `index.astro`, or page routing templates.

---

## 5. Testing

### Data layer

- **Reconciliation:** stored catalog missing `score-training` → after `getGameTypes()`, catalog contains it with `released: true`; blob persisted
- **Reconciliation idempotent:** second call does not write if unchanged
- **Released filter:** `getGameTypes()` returns only `ten-up-one-down` and `score-training`
- **Unreleased lookup:** `getGameBySlug("501")` → `null`
- **Quick Start fallback:** no stats → first 2 released games (not 501)
- **Quick Start ranked:** play counts for unreleased games ignored in ranking pool

### Nav active logic

Extract pure function if needed for testability:

```ts
export function isNavActive(
  pathname: string,
  href: string,
  matchPrefix?: string
): boolean;
```

Cases:

- `("/", "/", undefined)` → true
- `("/games", "/", undefined)` → false
- `("/games", "/games", "/games")` → true
- `("/games/score-training", "/games", "/games")` → true
- `("/statistics", "/statistics", undefined)` → true

---

## 6. Error handling

No new error codes. Unreleased game URLs continue using `unknown-game` redirect and existing toast messaging.

---

## 7. Future considerations

- When 501 or 121 ship, set `released: true` in `SEED_GAMES`; reconciliation propagates on next read
- Runtime admin toggle could flip `released` in blob without deploy (reconciliation would need to avoid overwriting manual blob edits — out of scope; seed wins on reconcile today)
