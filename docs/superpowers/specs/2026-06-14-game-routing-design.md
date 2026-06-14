# Game Routing Architecture — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-14  
**Branch:** TBD  
**Scope:** Dynamic game routing (settings → play flow), blob-backed game catalog & config, prototype dummy UIs for three game types

---

## 1. Overview

Add a dynamic routing architecture so users can select a game from the home page or `/games`, configure it on a per-game settings page, and start playing on a per-game play page. Game metadata and session configuration are stored via API + Netlify Blobs (swappable for a DB later). Per-game UI components live in code; only data is blob-backed.

**Prototype games:** `501`, `ten-up-one-down`, `121`

**User flow:**

1. Click game on home (Quick Start) or `/games`
2. Land on `/games/settings-{slug}` — per-game config page (dummy content)
3. Configure game (dummy input)
4. Click "Start playing" — saves config via API
5. Navigate to `/games/{slug}` — per-game play page (dummy content)

| Item | Value |
|---|---|
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Hosting | Netlify (SSR Functions + Blobs) |
| Config routes | `/games/settings-{slug}` |
| Play routes | `/games/{slug}` |
| Storage | Netlify Blobs (data layer abstracted for future DB swap) |
| Prototype UIs | Dummy per-game content only — prove flow, not real game logic |

---

## 2. Architecture

Two layers with a clear boundary:

```
┌─────────────────────────────────────────────────────────┐
│  Code (compile-time)                                    │
│  Component registry: slug → Settings.astro / Play.astro │
│  (UI must live in code — Astro can't load from blobs)   │
└─────────────────────────────────────────────────────────┘
                          ↕ slug lookup
┌─────────────────────────────────────────────────────────┐
│  Data layer (runtime, swappable)                        │
│  lib/server/data/games.ts                               │
│    getGameTypes() / getGameBySlug() / saveGameConfig()  │
│    getQuickStartGames(userId)                           │
│  Backed by Netlify Blobs now → DB later                 │
└─────────────────────────────────────────────────────────┘
```

### Blob stores

| Store | Key pattern | Contents |
|---|---|---|
| `game-types` | `catalog` | Array: `{ slug, displayName, sortOrder, enabled }` |
| `user-game-stats` | `{userId}` | `{ playCounts: Record<slug, number> }` |
| `game-sessions` | `{userId}:{slug}` | User's saved config before play |

### Data layer contract

All consumers call `lib/server/data/games.ts` only. Blob access is internal (`games.blob.ts` or inline). A future DB swap replaces the implementation without changing function signatures or page/API consumers.

### Route validation

1. Dynamic route receives slug param
2. `getGameBySlug(slug)` from data layer
3. Missing or disabled → redirect `/games?error=unknown-game`
4. Found → resolve UI component from code registry
5. Component not registered for known slug → redirect `/games?error=unavailable-game`

### Quick Start (home page)

- `getQuickStartGames(userId, limit)` reads `user-game-stats`
- If play counts exist: return top N games by count
- Else: fallback to first N games from catalog (`sortOrder`)
- **Prototype:** `limit = 2` (matches current home layout)

### Games list (`/games`)

- `getGameTypes()` returns all enabled games sorted by `sortOrder`
- Order logic can evolve later without routing changes

### Catalog seed

`getGameTypes()` auto-seeds the catalog with the three prototype games if the blob store is empty (dev-friendly, consistent with existing preferences pattern).

---

## 3. URL structure

| Phase | URL example | Astro file |
|---|---|---|
| Config | `/games/settings-501` | `pages/games/settings-[game].astro` |
| Play | `/games/501` | `pages/games/[game].astro` |

Path helpers in `lib/shared/games/paths.ts`:

```ts
settingsPath("501")  // → "/games/settings-501"
playPath("501")      // → "/games/501"
```

**Route precedence:** `settings-[game].astro` handles the `settings-` prefix. The `[game].astro` play route must not match settings URLs (Astro resolves the more specific file; play route additionally validates slug against catalog).

---

## 4. File structure

```
app/src/
├── pages/
│   ├── index.astro                          ← Quick Start via getQuickStartGames()
│   ├── games.astro                          ← Full catalog + Toast
│   └── games/
│       ├── settings-[game].astro            ← Config shell + game Settings component
│       └── [game].astro                     ← Play shell + game Play component
│
├── pages/api/games/
│   ├── index.ts                             ← GET catalog
│   └── [slug]/
│       └── config.ts                        ← GET/PUT session config
│
├── components/games/
│   ├── GameCard.astro                       ← Link → settings route
│   ├── GameSettingsShell.astro              ← Shared config layout
│   ├── GamePlayShell.astro                  ← Shared play layout
│   ├── Toast.astro                          ← Error toast from ?error= param
│   ├── 501/
│   │   ├── Settings.astro
│   │   └── Play.astro
│   ├── ten-up-one-down/
│   │   ├── Settings.astro
│   │   └── Play.astro
│   └── 121/
│       ├── Settings.astro
│       └── Play.astro
│
└── lib/
    ├── server/data/
    │   └── games.ts                         ← Data layer (blob-backed, swappable)
    ├── client/alpine/games/
    │   └── toast.ts                         ← Toast show/dismiss + URL cleanup
    └── shared/games/
        ├── types.ts                         ← GameType, GameConfig, etc.
        ├── paths.ts                         ← Route path helpers
        └── components.ts                    ← slug → Astro component map
```

### Adding a new game later

1. Add entry to blob catalog (or extend seed)
2. Create `components/games/{slug}/Settings.astro` + `Play.astro`
3. Register components in `components.ts`

No new route files required.

---

## 5. Components

### `GameCard.astro`

Reusable card linking to `settingsPath(slug)`. Used on home (Quick Start) and `/games`.

### `GameSettingsShell.astro`

Shared config page wrapper:

- Game display name (from blob catalog)
- Back link → `/games`
- Slot for per-game `Settings.astro`
- "Start playing" button: `PUT /api/games/{slug}/config` → navigate to `playPath(slug)`

### `GamePlayShell.astro`

Shared play page wrapper:

- Game display name
- Back link → `settingsPath(slug)`
- Slot for per-game `Play.astro`

### Per-game dummy components

Each `Settings.astro`: unique placeholder text + one dummy input field.  
Each `Play.astro`: "Playing {displayName}" + slug identifier.  
Enough to visually distinguish games and prove the flow.

### `Toast.astro` + `toast.ts`

Displays error messages after redirect from invalid routes.

---

## 6. Data flow

```
Home / Games
  → click GameCard
  → GET /games/settings-{slug}
      SSR: getGameBySlug(slug) + render Settings component

Settings page
  → user configures (dummy input)
  → click "Start playing"
  → PUT /api/games/{slug}/config
  → navigate to /games/{slug}

Play page
  → GET /games/{slug}
      SSR: getGameBySlug(slug) + getGameConfig(userId, slug) + render Play component
  → increment playCount in user-game-stats (on page load, prototype)
```

### SSR vs API access

| Consumer | Data access |
|---|---|
| `index.astro`, `games.astro`, dynamic routes | Direct `lib/server/data/games.ts` (SSR) |
| Settings "Start" button (client) | `PUT /api/games/{slug}/config` |
| Future client needs | `GET /api/games` |

SSR pages do not call their own API routes — same pattern as `settings.astro` → `getPreferences()`.

### Config shape (prototype)

```ts
type GameConfig = {
  slug: string;
  settings: Record<string, unknown>;
  updatedAt: string;
};
```

Per-game `Settings.astro` owns its `settings` field shape. The shared type stays generic until real per-game schemas are defined.

### Types

```ts
type GameType = {
  slug: string;
  displayName: string;
  sortOrder: number;
  enabled: boolean;
};

type UserGameStats = {
  playCounts: Record<string, number>;
};
```

---

## 7. API routes

### `GET /api/games`

Returns enabled game catalog. Auth required. For future client-side use.

### `GET /api/games/{slug}/config`

Returns saved session config for current user + slug. Auth required.

### `PUT /api/games/{slug}/config`

Saves session config. Auth required. Body: `{ settings: Record<string, unknown> }`.

Response pattern matches existing API routes (`ApiResponse` from `@lib/shared/api/types`).

---

## 8. Error handling

| Scenario | Behavior |
|---|---|
| Unknown/disabled slug on settings or play route | Redirect → `/games?error=unknown-game` |
| Slug in catalog but no UI component registered | Redirect → `/games?error=unavailable-game` |
| API config save fails (network/500) | Inline error on settings page; user stays on page |
| Blob read fails on SSR page | Empty catalog / empty config; page still renders |
| Unauthenticated API call | `401` + `{ ok: false, code: UNAUTHORIZED }` |

### Toast behavior

1. User lands on `/games?error=unknown-game` (or `unavailable-game`)
2. `Toast.astro` reads `error` query param on mount
3. Maps code to user-facing message via `t()` / error messages
4. Toast visible ~4 seconds, then auto-dismisses
5. **On dismiss:** `history.replaceState` removes the `?error=` param — URL becomes clean `/games`

The error query param must not persist in the address bar after the toast disappears.

### New error codes

```ts
UNKNOWN_GAME = "UNKNOWN_GAME"
UNAVAILABLE_GAME = "UNAVAILABLE_GAME"
```

Toast query param values (URL-safe): `unknown-game`, `unavailable-game` — mapped to message codes in the toast component.

Settings page inline save failure uses existing `NETWORK_ERROR` / `SERVER_ERROR` codes.

---

## 9. Testing

| Layer | Tests |
|---|---|
| `lib/shared/games/paths.ts` | `settingsPath("501")` → `/games/settings-501`, `playPath("501")` → `/games/501` |
| `lib/server/data/games.ts` | Seed on empty store, `getGameBySlug`, `getQuickStartGames` fallback when no stats |
| `lib/shared/games/components.ts` | Registry resolves known slugs; returns undefined for unknown |
| `pages/api/games/[slug]/config.ts` | Auth, validation, save/read round-trip (mock blobs) |
| `lib/client/alpine/games/toast.ts` | Shows message from `?error=`, cleans URL on dismiss |

### Manual verification checklist

1. `/games` lists all 3 games from blob catalog
2. `/` Quick Start shows first 2 games (no stats yet)
3. Click game → settings page with game-specific dummy content
4. "Start playing" → saves config → lands on play page with correct dummy content
5. `/games/invalid` → redirect to `/games?error=unknown-game` → toast shows → URL becomes `/games`
6. `/games/settings-invalid` → same toast + URL cleanup behavior
7. Play a game twice → Quick Start order reflects incremented play count

---

## 10. Out of scope

- Real game scoring logic or interactive play UIs
- Per-game settings validation schemas (beyond generic `Record<string, unknown>`)
- Admin UI for managing game catalog
- Database migration (architecture supports it; not implemented)
- Games page sort order beyond `sortOrder` from catalog
- i18n for game-specific content (display names are data-driven English strings for now)

---

## 11. Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| URL pattern | `/games/settings-{slug}` + `/games/{slug}` | User preference; settings prefix keeps play URLs short |
| Game catalog storage | Netlify Blobs via data layer | Consistent with preferences; swappable for DB |
| UI components | Code registry + per-game folders | Astro requires compile-time components |
| Unknown slug | Redirect + toast, not 404 | User preference |
| URL after error | Clean `/games` after toast dismisses | User preference |
| Home Quick Start | Stats-driven with catalog fallback | Future-ready; prototype uses first N |
| Prototype game count | 3 (`501`, `ten-up-one-down`, `121`) | User preference |
