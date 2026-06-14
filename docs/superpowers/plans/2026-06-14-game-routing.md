# Game Routing Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each implementer subagent MUST also use superpowers:test-driven-development for code tasks and superpowers:verification-before-completion before claiming done.

**Goal:** Add dynamic game routing so users can select a game, configure it on a per-game settings page, save config via API + Netlify Blobs, and play on a per-game play page — with dummy UIs proving the full flow.

**Architecture:** Game metadata and session config live in a swappable blob-backed data layer (`lib/server/data/games.ts`). Per-game UI is a compile-time component registry mapping slug → `SettingsForm.astro` / `Play.astro`. Two thin dynamic Astro routes (`settings-[game].astro`, `[game].astro`) validate slugs and render shared shells. Unknown slugs redirect to `/games?error=...`; toast cleans the URL on dismiss.

**Tech Stack:** Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript, Netlify Blobs, Vitest, jsdom

**Branch:** TBD (from `polish-ui` or new feature branch)  
**Spec:** `docs/superpowers/specs/2026-06-14-game-routing-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

**Verification order (every task after Task 1):**
```
npm run check  →  npm test  →  npm run build
```

**Dev note:** Blob persistence requires `netlify dev` from repo root. Auth-only smoke tests work with `npm run dev` in `app/`.

---

## Design Decisions (from spec)

| Topic | Decision |
|---|---|
| Config URL | `/games/settings-{slug}` |
| Play URL | `/games/{slug}` |
| Per-game settings UI | `SettingsForm.astro` (not `Settings.astro`) |
| Catalog storage | Netlify Blobs via `games.ts` data layer |
| Unknown slug | Redirect `/games?error=unknown-game` + toast |
| URL after error toast | `history.replaceState` → clean `/games` on dismiss |
| Home Quick Start | Top N by play count; fallback first N from catalog (`limit = 2`) |
| Prototype games | `501`, `ten-up-one-down`, `121` |
| User identity for blobs | `session.username` set on login (extends existing session) |

**Out of scope:** Real game logic, admin catalog UI, DB migration, per-game validation schemas.

---

## File Structure Overview

| File | Responsibility |
|---|---|
| `src/lib/shared/games/types.ts` | `GameType`, `GameConfig`, `UserGameStats` |
| `src/lib/shared/games/paths.ts` | `settingsPath()`, `playPath()` |
| `src/lib/shared/games/components.ts` | Slug → `SettingsForm` / `Play` component map |
| `src/lib/shared/games/errors.ts` | URL error param → `MessageCode` mapping |
| `src/lib/shared/constants/errors.constants.ts` | Add `UNKNOWN_GAME`, `UNAVAILABLE_GAME` |
| `src/lib/shared/api/types.ts` | Add `GameConfigSuccess`, `GamesCatalogSuccess` |
| `src/lib/server/auth/session.ts` | Add `username?: string` to `SessionData` |
| `src/pages/api/auth/login.ts` | Persist `session.username` on login |
| `src/lib/server/data/games.ts` | Blob-backed data layer + seed catalog |
| `src/pages/api/games/index.ts` | `GET` catalog |
| `src/pages/api/games/[slug]/config.ts` | `GET`/`PUT` session config |
| `src/lib/client/alpine/games/toast.ts` | Toast show/dismiss + URL cleanup |
| `src/lib/client/alpine/games/game-settings.shell.ts` | Start button: save config + navigate |
| `src/lib/client/alpine/app.factory.ts` | Register new Alpine factories |
| `src/components/games/GameCard.astro` | Card linking to settings route |
| `src/components/games/GameSettingsShell.astro` | Shared config page wrapper |
| `src/components/games/GamePlayShell.astro` | Shared play page wrapper |
| `src/components/games/Toast.astro` | Toast UI on `/games` |
| `src/components/games/{slug}/SettingsForm.astro` | Per-game dummy config (×3) |
| `src/components/games/{slug}/Play.astro` | Per-game dummy play UI (×3) |
| `src/pages/games/settings-[game].astro` | Dynamic settings route |
| `src/pages/games/[game].astro` | Dynamic play route |
| `src/pages/games.astro` | Full catalog + toast |
| `src/pages/index.astro` | Quick Start cards |

---

### Task 1: Game Path Helpers

**Files:**
- Create: `app/src/lib/shared/games/paths.ts`
- Create: `app/tests/lib/shared/games/paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { settingsPath, playPath } from "@lib/shared/games/paths";

describe("game paths", () => {
  it("builds settings path", () => {
    expect(settingsPath("501")).toBe("/games/settings-501");
    expect(settingsPath("ten-up-one-down")).toBe(
      "/games/settings-ten-up-one-down"
    );
  });

  it("builds play path", () => {
    expect(playPath("501")).toBe("/games/501");
    expect(playPath("121")).toBe("/games/121");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/games/paths.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Build the per-game settings route path.
 */
export function settingsPath(slug: string): string {
  return `/games/settings-${slug}`;
}

/**
 * Build the per-game play route path.
 */
export function playPath(slug: string): string {
  return `/games/${slug}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/shared/games/paths.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/games/paths.ts tests/lib/shared/games/paths.test.ts
git commit -m "feat: add game route path helpers"
```

---

### Task 2: Shared Types & Error Codes

**Files:**
- Create: `app/src/lib/shared/games/types.ts`
- Create: `app/src/lib/shared/games/errors.ts`
- Modify: `app/src/lib/shared/constants/errors.constants.ts`
- Modify: `app/src/lib/shared/api/types.ts`
- Create: `app/tests/lib/shared/games/errors.test.ts`
- Modify: `app/tests/lib/shared/constants/errors.constants.test.ts`

- [ ] **Step 1: Write the failing test for error mapping**

```ts
import { describe, it, expect } from "vitest";
import { errorParamToMessageCode } from "@lib/shared/games/errors";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("errorParamToMessageCode", () => {
  it("maps known URL error params", () => {
    expect(errorParamToMessageCode("unknown-game")).toBe(
      MessageCode.UNKNOWN_GAME
    );
    expect(errorParamToMessageCode("unavailable-game")).toBe(
      MessageCode.UNAVAILABLE_GAME
    );
  });

  it("returns null for unknown params", () => {
    expect(errorParamToMessageCode("nope")).toBeNull();
    expect(errorParamToMessageCode(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/games/errors.test.ts`
Expected: FAIL

- [ ] **Step 3: Add types, error codes, and mapping**

`src/lib/shared/games/types.ts`:

```ts
export type GameType = {
  slug: string;
  displayName: string;
  sortOrder: number;
  enabled: boolean;
};

export type GameConfig = {
  slug: string;
  settings: Record<string, unknown>;
  updatedAt: string;
};

export type UserGameStats = {
  playCounts: Record<string, number>;
};

export const SEED_GAMES: GameType[] = [
  { slug: "501", displayName: "501", sortOrder: 1, enabled: true },
  {
    slug: "ten-up-one-down",
    displayName: "Ten Up One Down",
    sortOrder: 2,
    enabled: true,
  },
  { slug: "121", displayName: "121", sortOrder: 3, enabled: true },
];
```

Add to `errors.constants.ts`:

```ts
UNKNOWN_GAME: "UNKNOWN_GAME",
UNAVAILABLE_GAME: "UNAVAILABLE_GAME",
```

Add messages:

```ts
[MessageCode.UNKNOWN_GAME]: "That game does not exist.",
[MessageCode.UNAVAILABLE_GAME]: "That game is not available yet.",
```

`src/lib/shared/games/errors.ts`:

```ts
import { MessageCode } from "@lib/shared/constants/errors.constants";

const ERROR_PARAM_MAP: Record<string, MessageCode> = {
  "unknown-game": MessageCode.UNKNOWN_GAME,
  "unavailable-game": MessageCode.UNAVAILABLE_GAME,
};

/**
 * Map a toast URL error param to a MessageCode, or null if unrecognized.
 */
export function errorParamToMessageCode(
  param: string | null | undefined
): MessageCode | null {
  if (!param) return null;
  return ERROR_PARAM_MAP[param] ?? null;
}
```

Add to `api/types.ts`:

```ts
import type { GameConfig, GameType } from "@lib/shared/games/types";

export type GamesCatalogSuccess = { ok: true; games: GameType[] };
export type GameConfigSuccess = { ok: true; config: GameConfig };
```

Update `ApiSuccess` union to include `GamesCatalogSuccess | GameConfigSuccess`.

- [ ] **Step 4: Update errors.constants.test.ts** — add expectations for the two new codes/messages.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/lib/shared/games/errors.test.ts tests/lib/shared/constants/errors.constants.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/games/types.ts src/lib/shared/games/errors.ts \
  src/lib/shared/constants/errors.constants.ts src/lib/shared/api/types.ts \
  tests/lib/shared/games/errors.test.ts tests/lib/shared/constants/errors.constants.test.ts
git commit -m "feat: add game types and error codes"
```

---

### Task 3: Session Username (User Identity for Blobs)

**Files:**
- Modify: `app/src/lib/server/auth/session.ts`
- Modify: `app/src/pages/api/auth/login.ts`
- Modify: `app/tests/api/auth/login.test.ts`

- [ ] **Step 1: Extend session type and login handler**

`session.ts` — add to `SessionData`:

```ts
export interface SessionData {
  isLoggedIn: boolean;
  username?: string;
}
```

`login.ts` — after credential validation, before save:

```ts
session.isLoggedIn = true;
session.username = username;
await session.save();
```

- [ ] **Step 2: Update login test** — assert `session.username` is set on successful login (mock session object in existing test file).

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/api/auth/login.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/auth/session.ts src/pages/api/auth/login.ts tests/api/auth/login.test.ts
git commit -m "feat: persist username in session for per-user game data"
```

---

### Task 4: Games Data Layer (Netlify Blobs)

**Files:**
- Create: `app/src/lib/server/data/games.ts`
- Create: `app/tests/lib/server/data/games.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSetJSON = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn((name: string) => ({
    get: (...args: unknown[]) => mockGet(name, ...args),
    setJSON: (...args: unknown[]) => mockSetJSON(name, ...args),
  })),
}));

import {
  getGameTypes,
  getGameBySlug,
  getQuickStartGames,
  saveGameConfig,
  getGameConfig,
  incrementPlayCount,
} from "@lib/server/data/games";
import { SEED_GAMES } from "@lib/shared/games/types";

describe("games data layer", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetJSON.mockReset();
  });

  it("seeds catalog when store is empty", async () => {
    mockGet.mockResolvedValue(null);
    const games = await getGameTypes();
    expect(games).toEqual(SEED_GAMES);
    expect(mockSetJSON).toHaveBeenCalledWith("game-types", "catalog", SEED_GAMES);
  });

  it("getGameBySlug returns enabled game", async () => {
    mockGet.mockImplementation((store: string) => {
      if (store === "game-types") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    const game = await getGameBySlug("501");
    expect(game?.slug).toBe("501");
  });

  it("getGameBySlug returns null for unknown slug", async () => {
    mockGet.mockImplementation((store: string) => {
      if (store === "game-types") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    await expect(getGameBySlug("invalid")).resolves.toBeNull();
  });

  it("getQuickStartGames falls back to first N when no stats", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      if (store === "user-game-stats") return Promise.resolve(null);
      return Promise.resolve(null);
    });
    const games = await getQuickStartGames("alex", 2);
    expect(games.map((g) => g.slug)).toEqual(["501", "ten-up-one-down"]);
  });

  it("getQuickStartGames sorts by play count when stats exist", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      if (store === "user-game-stats" && key === "alex") {
        return Promise.resolve({ playCounts: { "121": 5, "501": 2 } });
      }
      return Promise.resolve(null);
    });
    const games = await getQuickStartGames("alex", 2);
    expect(games.map((g) => g.slug)).toEqual(["121", "501"]);
  });

  it("saveGameConfig and getGameConfig round-trip", async () => {
    const saved: Record<string, unknown> = {};
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-sessions" && key === "alex:501") {
        return Promise.resolve(saved[key] ?? null);
      }
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    mockSetJSON.mockImplementation((store: string, key: string, value: unknown) => {
      if (store === "game-sessions") saved[key] = value;
      return Promise.resolve();
    });

    await saveGameConfig("alex", "501", { startingScore: 501 });
    const config = await getGameConfig("alex", "501");
    expect(config?.settings).toEqual({ startingScore: 501 });
    expect(config?.slug).toBe("501");
  });

  it("incrementPlayCount updates user stats", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "user-game-stats" && key === "alex") {
        return Promise.resolve({ playCounts: { "501": 1 } });
      }
      return Promise.resolve(null);
    });
    await incrementPlayCount("alex", "501");
    expect(mockSetJSON).toHaveBeenCalledWith(
      "user-game-stats",
      "alex",
      { playCounts: { "501": 2 } }
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/server/data/games.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `games.ts`**

```ts
import { getStore } from "@netlify/blobs";
import {
  SEED_GAMES,
  type GameConfig,
  type GameType,
  type UserGameStats,
} from "@lib/shared/games/types";

const CATALOG_STORE = "game-types";
const CATALOG_KEY = "catalog";
const STATS_STORE = "user-game-stats";
const SESSIONS_STORE = "game-sessions";

async function readCatalog(): Promise<GameType[]> {
  const store = getStore(CATALOG_STORE);
  const data = await store.get(CATALOG_KEY, { type: "json" });
  if (!data) {
    await store.setJSON(CATALOG_KEY, SEED_GAMES);
    return SEED_GAMES;
  }
  return data as GameType[];
}

/**
 * Return all enabled game types sorted by sortOrder.
 */
export async function getGameTypes(): Promise<GameType[]> {
  const catalog = await readCatalog();
  return catalog
    .filter((game) => game.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Look up a single enabled game by slug.
 */
export async function getGameBySlug(slug: string): Promise<GameType | null> {
  const games = await getGameTypes();
  return games.find((game) => game.slug === slug) ?? null;
}

/**
 * Return top N games by play count, falling back to catalog order.
 */
export async function getQuickStartGames(
  userId: string,
  limit: number
): Promise<GameType[]> {
  const catalog = await getGameTypes();
  const store = getStore(STATS_STORE);
  const stats =
    ((await store.get(userId, { type: "json" })) as UserGameStats | null) ??
    { playCounts: {} };

  const ranked = [...catalog].sort((a, b) => {
    const aCount = stats.playCounts[a.slug] ?? 0;
    const bCount = stats.playCounts[b.slug] ?? 0;
    if (bCount !== aCount) return bCount - aCount;
    return a.sortOrder - b.sortOrder;
  });

  const hasPlays = Object.values(stats.playCounts).some((count) => count > 0);
  if (!hasPlays) {
    return catalog.slice(0, limit);
  }

  return ranked.slice(0, limit);
}

/**
 * Persist per-user game session config before play.
 */
export async function saveGameConfig(
  userId: string,
  slug: string,
  settings: Record<string, unknown>
): Promise<GameConfig> {
  const config: GameConfig = {
    slug,
    settings,
    updatedAt: new Date().toISOString(),
  };
  const store = getStore(SESSIONS_STORE);
  await store.setJSON(`${userId}:${slug}`, config);
  return config;
}

/**
 * Read saved session config for a user and game slug.
 */
export async function getGameConfig(
  userId: string,
  slug: string
): Promise<GameConfig | null> {
  const store = getStore(SESSIONS_STORE);
  const data = await store.get(`${userId}:${slug}`, { type: "json" });
  return (data as GameConfig | null) ?? null;
}

/**
 * Increment play count for a user/game pair.
 */
export async function incrementPlayCount(
  userId: string,
  slug: string
): Promise<void> {
  const store = getStore(STATS_STORE);
  const existing =
    ((await store.get(userId, { type: "json" })) as UserGameStats | null) ??
    { playCounts: {} };
  const playCounts = { ...existing.playCounts };
  playCounts[slug] = (playCounts[slug] ?? 0) + 1;
  await store.setJSON(userId, { playCounts });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/lib/server/data/games.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/data/games.ts tests/lib/server/data/games.test.ts
git commit -m "feat: add blob-backed games data layer"
```

---

### Task 5: Component Registry

**Files:**
- Create: `app/src/lib/shared/games/components.ts`
- Create: `app/tests/lib/shared/games/components.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  getSettingsFormComponent,
  getPlayComponent,
  hasGameComponents,
} from "@lib/shared/games/components";

describe("game component registry", () => {
  it("resolves known slugs", () => {
    expect(hasGameComponents("501")).toBe(true);
    expect(getSettingsFormComponent("501")).toBeDefined();
    expect(getPlayComponent("501")).toBeDefined();
  });

  it("returns undefined for unknown slugs", () => {
    expect(hasGameComponents("invalid")).toBe(false);
    expect(getSettingsFormComponent("invalid")).toBeUndefined();
    expect(getPlayComponent("invalid")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/shared/games/components.test.ts`
Expected: FAIL

- [ ] **Step 3: Create placeholder components and registry**

Create minimal placeholder files first (will be replaced with real dummy UIs in Task 10):

`components/games/501/SettingsForm.astro`:
```astro
<input type="text" name="startingScore" value="501" class="input" />
```

`components/games/501/Play.astro`:
```astro
<p>Playing 501</p>
```

(Same pattern for `ten-up-one-down` and `121` with distinct placeholder text.)

`components.ts`:

```ts
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import Settings501 from "@components/games/501/SettingsForm.astro";
import Play501 from "@components/games/501/Play.astro";
import SettingsTenUp from "@components/games/ten-up-one-down/SettingsForm.astro";
import PlayTenUp from "@components/games/ten-up-one-down/Play.astro";
import Settings121 from "@components/games/121/SettingsForm.astro";
import Play121 from "@components/games/121/Play.astro";

type GameComponentPair = {
  settingsForm: AstroComponentFactory;
  play: AstroComponentFactory;
};

const REGISTRY: Record<string, GameComponentPair> = {
  "501": { settingsForm: Settings501, play: Play501 },
  "ten-up-one-down": { settingsForm: SettingsTenUp, play: PlayTenUp },
  "121": { settingsForm: Settings121, play: Play121 },
};

export function hasGameComponents(slug: string): boolean {
  return slug in REGISTRY;
}

export function getSettingsFormComponent(
  slug: string
): AstroComponentFactory | undefined {
  return REGISTRY[slug]?.settingsForm;
}

export function getPlayComponent(
  slug: string
): AstroComponentFactory | undefined {
  return REGISTRY[slug]?.play;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/lib/shared/games/components.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/games/components.ts src/components/games/ \
  tests/lib/shared/games/components.test.ts
git commit -m "feat: add game component registry with placeholder UIs"
```

---

### Task 6: Games API Routes

**Files:**
- Create: `app/src/pages/api/games/index.ts`
- Create: `app/src/pages/api/games/[slug]/config.ts`
- Create: `app/tests/api/games/index.test.ts`
- Create: `app/tests/api/games/config.test.ts`

- [ ] **Step 1: Write failing API tests** (mirror `preferences.test.ts` pattern — mock `getSession`, mock `games.ts` functions).

`index.test.ts` key cases:
- 401 when logged out
- 200 with games array when logged in

`config.test.ts` key cases:
- GET 401 when logged out
- GET 200 returns config
- PUT 401 when logged out
- PUT 400 when body missing/invalid JSON
- PUT 200 saves config

- [ ] **Step 2: Run tests — verify FAIL**

- [ ] **Step 3: Implement routes**

`pages/api/games/index.ts`:

```ts
import type { APIRoute } from "astro";
import type { ApiResponse, GamesCatalogSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { getSession } from "@lib/server/auth/session";
import { getGameTypes } from "@lib/server/data/games";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ cookies }) => {
  const session = await getSession(cookies);
  if (!session.isLoggedIn || !session.username) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    const games = await getGameTypes();
    const body: GamesCatalogSuccess = { ok: true, games };
    return jsonResponse(body, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
```

`pages/api/games/[slug]/config.ts`:

```ts
import type { APIRoute } from "astro";
import type { ApiResponse, GameConfigSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { getSession } from "@lib/server/auth/session";
import {
  getGameBySlug,
  getGameConfig,
  saveGameConfig,
} from "@lib/server/data/games";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ params, cookies }) => {
  const session = await getSession(cookies);
  if (!session.isLoggedIn || !session.username) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const slug = params.slug ?? "";
  const game = await getGameBySlug(slug);
  if (!game) {
    return jsonResponse({ ok: false, code: MessageCode.UNKNOWN_GAME }, 404);
  }

  try {
    const config = await getGameConfig(session.username, slug);
    const body: GameConfigSuccess = {
      ok: true,
      config: config ?? { slug, settings: {}, updatedAt: "" },
    };
    return jsonResponse(body, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const session = await getSession(cookies);
  if (!session.isLoggedIn || !session.username) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  const slug = params.slug ?? "";
  const game = await getGameBySlug(slug);
  if (!game) {
    return jsonResponse({ ok: false, code: MessageCode.UNKNOWN_GAME }, 404);
  }

  let body: { settings?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  if (!body.settings || typeof body.settings !== "object") {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  try {
    const config = await saveGameConfig(
      session.username,
      slug,
      body.settings
    );
    const response: GameConfigSuccess = { ok: true, config };
    return jsonResponse(response, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
```

- [ ] **Step 4: Run tests — verify PASS**

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/games/ tests/api/games/
git commit -m "feat: add games catalog and config API routes"
```

---

### Task 7: Alpine Toast (URL Cleanup on Dismiss)

**Files:**
- Create: `app/src/lib/client/alpine/games/toast.ts`
- Create: `app/tests/lib/client/alpine/games/toast.test.ts`
- Modify: `app/src/lib/client/alpine/app.factory.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gameToast } from "@lib/client/alpine/games/toast";

describe("gameToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    history.replaceState({}, "", "/games?error=unknown-game");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows message from error param and cleans URL on dismiss", () => {
    const toast = gameToast();
    toast.init();

    expect(toast.visible).toBe(true);
    expect(toast.message).toBe("That game does not exist.");

    vi.advanceTimersByTime(4000);
    expect(toast.visible).toBe(false);
    expect(window.location.pathname).toBe("/games");
    expect(window.location.search).toBe("");
  });

  it("stays hidden when no error param", () => {
    history.replaceState({}, "", "/games");
    const toast = gameToast();
    toast.init();
    expect(toast.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

- [ ] **Step 3: Implement toast factory**

```ts
import { errorParamToMessageCode } from "@lib/shared/games/errors";
import { t } from "@lib/shared/i18n";

const TOAST_DURATION_MS = 4000;

interface GameToastState {
  visible: boolean;
  message: string;
  init(): void;
}

/**
 * Alpine data factory for the games page error toast.
 * Cleans the URL when the toast dismisses.
 */
export function gameToast(): GameToastState {
  return {
    visible: false,
    message: "",

    init() {
      const params = new URLSearchParams(window.location.search);
      const code = errorParamToMessageCode(params.get("error"));
      if (!code) return;

      this.message = t(code);
      this.visible = true;

      window.setTimeout(() => {
        this.visible = false;
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        history.replaceState({}, "", `${url.pathname}${url.search}`);
      }, TOAST_DURATION_MS);
    },
  };
}
```

Register in `app.factory.ts`:
```ts
import { gameToast } from "@lib/client/alpine/games/toast";
Alpine.data("gameToast", gameToast);
```

(File name in plan: `toast.ts` — use `gameToast` as Alpine name.)

- [ ] **Step 4: Run test — verify PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/alpine/games/toast.ts tests/lib/client/alpine/games/toast.test.ts \
  src/lib/client/alpine/app.factory.ts
git commit -m "feat: add game error toast with URL cleanup on dismiss"
```

---

### Task 8: Alpine Game Settings Shell (Start Playing)

**Files:**
- Create: `app/src/lib/client/alpine/games/game-settings.shell.ts`
- Create: `app/tests/lib/client/alpine/games/game-settings.shell.test.ts`
- Modify: `app/src/lib/client/alpine/app.factory.ts`

- [ ] **Step 1: Write failing test**

Test cases:
- `start()` collects `FormData` from `#game-settings-form`, PUTs to `/api/games/{slug}/config`, navigates to play path on success
- Shows inline error on API failure
- Shows network error on fetch throw

- [ ] **Step 2: Run test — verify FAIL**

- [ ] **Step 3: Implement factory**

```ts
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";

interface GameSettingsShellState {
  slug: string;
  playUrl: string;
  loading: boolean;
  error: string;
  formDataToSettings(form: HTMLFormElement): Record<string, unknown>;
  async start(): Promise<void>;
}

/**
 * Alpine data factory for the shared game settings shell.
 */
export function gameSettingsShell(
  slug: string,
  playUrl: string
): GameSettingsShellState {
  return {
    slug,
    playUrl,
    loading: false,
    error: "",

    formDataToSettings(form: HTMLFormElement): Record<string, unknown> {
      const settings: Record<string, unknown> = {};
      for (const [key, value] of new FormData(form).entries()) {
        if (typeof value === "string") {
          settings[key] = value;
        }
      }
      return settings;
    },

    async start() {
      const form = document.getElementById(
        "game-settings-form"
      ) as HTMLFormElement | null;
      if (!form) return;

      this.loading = true;
      this.error = "";

      try {
        const response = await fetch(`/api/games/${this.slug}/config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: this.formDataToSettings(form),
          }),
        });

        const data: ApiResponse = await response.json();
        if (!data.ok) {
          this.error = data.code ? t(data.code) : t(MessageCode.SERVER_ERROR);
          return;
        }

        window.location.href = this.playUrl;
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },
  };
}
```

Register: `Alpine.data("gameSettingsShell", gameSettingsShell);`

- [ ] **Step 4: Run test — verify PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/alpine/games/game-settings.shell.ts \
  tests/lib/client/alpine/games/game-settings.shell.test.ts \
  src/lib/client/alpine/app.factory.ts
git commit -m "feat: add game settings shell Alpine factory"
```

---

### Task 9: Shared Astro Components

**Files:**
- Create: `app/src/components/games/GameCard.astro`
- Create: `app/src/components/games/GameSettingsShell.astro`
- Create: `app/src/components/games/GamePlayShell.astro`
- Create: `app/src/components/games/Toast.astro`

- [ ] **Step 1: Create `GameCard.astro`**

```astro
---
import Card from "@components/ui/Card.astro";
import { settingsPath } from "@lib/shared/games/paths";
import type { GameType } from "@lib/shared/games/types";

interface Props {
  game: GameType;
}

const { game } = Astro.props;
---

<Card>
  <a href={settingsPath(game.slug)} class="block text-text-primary font-medium">
    {game.displayName}
  </a>
</Card>
```

- [ ] **Step 2: Create `GameSettingsShell.astro`**

```astro
---
import PrimaryBtn from "@components/ui/PrimaryBtn.astro";
import { playPath } from "@lib/shared/games/paths";
import type { GameType } from "@lib/shared/games/types";

interface Props {
  game: GameType;
}

const { game } = Astro.props;
const playUrl = playPath(game.slug);
---

<main
  class="mx-auto w-full max-w-2xl flex-1 p-4 @sm:p-6"
  x-data={`gameSettingsShell('${game.slug}', '${playUrl}')`}
>
  <header class="mb-6 space-y-1">
    <a href="/games" class="text-text-muted text-sm hover:text-text-primary">
      ← Back to games
    </a>
    <h1 class="text-text-primary text-2xl font-semibold">{game.displayName}</h1>
    <p class="text-text-muted text-sm">Configure your game settings.</p>
  </header>

  <form id="game-settings-form" class="space-y-4" @submit.prevent="start()">
    <slot />
    <p x-show="error" x-text="error" x-cloak class="text-sm text-red-400" role="alert"></p>
    <PrimaryBtn type="submit">Start playing</PrimaryBtn>
  </form>
</main>
```

- [ ] **Step 3: Create `GamePlayShell.astro`**

```astro
---
import { settingsPath } from "@lib/shared/games/paths";
import type { GameType } from "@lib/shared/games/types";

interface Props {
  game: GameType;
}

const { game } = Astro.props;
---

<main class="mx-auto w-full max-w-2xl flex-1 p-4 @sm:p-6">
  <header class="mb-6 space-y-1">
    <a
      href={settingsPath(game.slug)}
      class="text-text-muted text-sm hover:text-text-primary"
    >
      ← Back to settings
    </a>
    <h1 class="text-text-primary text-2xl font-semibold">{game.displayName}</h1>
  </header>
  <slot />
</main>
```

- [ ] **Step 4: Create `Toast.astro`**

```astro
<div
  x-data="gameToast()"
  x-init="init()"
  x-show="visible"
  x-cloak
  role="alert"
  aria-live="polite"
  class="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary shadow-card"
>
  <span x-text="message"></span>
</div>
```

- [ ] **Step 5: Run verification**

Run: `npm run check && npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/games/GameCard.astro src/components/games/GameSettingsShell.astro \
  src/components/games/GamePlayShell.astro src/components/games/Toast.astro
git commit -m "feat: add shared game UI shells and card"
```

---

### Task 10: Per-Game Dummy SettingsForm & Play Components

**Files:**
- Modify: `app/src/components/games/501/SettingsForm.astro`
- Modify: `app/src/components/games/501/Play.astro`
- Modify: `app/src/components/games/ten-up-one-down/SettingsForm.astro`
- Modify: `app/src/components/games/ten-up-one-down/Play.astro`
- Modify: `app/src/components/games/121/SettingsForm.astro`
- Modify: `app/src/components/games/121/Play.astro`

- [ ] **Step 1: Replace placeholders with distinct dummy content**

`501/SettingsForm.astro`:
```astro
<label class="block space-y-1">
  <span class="text-text-muted text-sm">Starting score</span>
  <input type="number" name="startingScore" value="501" class="input w-full" />
</label>
```

`501/Play.astro`:
```astro
---
interface Props {
  displayName: string;
  slug: string;
}
const { displayName, slug } = Astro.props;
---
<section class="card space-y-2">
  <p class="text-text-primary">Playing {displayName}</p>
  <p class="text-text-muted text-sm">Game slug: {slug}</p>
  <p class="text-text-muted text-sm">[501 play UI placeholder]</p>
</section>
```

`ten-up-one-down/SettingsForm.astro`:
```astro
<label class="block space-y-1">
  <span class="text-text-muted text-sm">Target score</span>
  <input type="number" name="targetScore" value="10" class="input w-full" />
</label>
```

`ten-up-one-down/Play.astro` — same props pattern, text: `[Ten Up One Down play UI placeholder]`

`121/SettingsForm.astro`:
```astro
<label class="block space-y-1">
  <span class="text-text-muted text-sm">Starting points</span>
  <input type="number" name="startingPoints" value="121" class="input w-full" />
</label>
```

`121/Play.astro` — same props pattern, text: `[121 play UI placeholder]`

- [ ] **Step 2: Run verification**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/games/
git commit -m "feat: add per-game dummy SettingsForm and Play components"
```

---

### Task 11: Dynamic Routes

**Files:**
- Create: `app/src/pages/games/settings-[game].astro`
- Create: `app/src/pages/games/[game].astro`

- [ ] **Step 1: Create `settings-[game].astro`**

```astro
---
import AppLayout from "@layouts/AppLayout.astro";
import GameSettingsShell from "@components/games/GameSettingsShell.astro";
import { getGameBySlug } from "@lib/server/data/games";
import {
  getSettingsFormComponent,
  hasGameComponents,
} from "@lib/shared/games/components";

const { game: slug } = Astro.params;

if (!slug) {
  return Astro.redirect("/games?error=unknown-game");
}

const game = await getGameBySlug(slug);
if (!game) {
  return Astro.redirect("/games?error=unknown-game");
}

if (!hasGameComponents(slug)) {
  return Astro.redirect("/games?error=unavailable-game");
}

const SettingsForm = getSettingsFormComponent(slug)!;
---

<AppLayout>
  <GameSettingsShell game={game}>
    <SettingsForm />
  </GameSettingsShell>
</AppLayout>
```

- [ ] **Step 2: Create `[game].astro`**

```astro
---
import AppLayout from "@layouts/AppLayout.astro";
import GamePlayShell from "@components/games/GamePlayShell.astro";
import {
  getGameBySlug,
  incrementPlayCount,
} from "@lib/server/data/games";
import { getPlayComponent, hasGameComponents } from "@lib/shared/games/components";
import { getSession } from "@lib/server/auth/session";

const { game: slug } = Astro.params;

if (!slug) {
  return Astro.redirect("/games?error=unknown-game");
}

const game = await getGameBySlug(slug);
if (!game) {
  return Astro.redirect("/games?error=unknown-game");
}

if (!hasGameComponents(slug)) {
  return Astro.redirect("/games?error=unavailable-game");
}

const session = await getSession(Astro.cookies);
if (session.isLoggedIn && session.username) {
  try {
    await incrementPlayCount(session.username, slug);
  } catch {
    // Non-fatal for prototype
  }
}

const Play = getPlayComponent(slug)!;
---

<AppLayout>
  <GamePlayShell game={game}>
    <Play displayName={game.displayName} slug={game.slug} />
  </GamePlayShell>
</AppLayout>
```

- [ ] **Step 3: Run verification**

Run: `npm run check && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/games/
git commit -m "feat: add dynamic game settings and play routes"
```

---

### Task 12: Wire Home & Games List Pages

**Files:**
- Modify: `app/src/pages/index.astro`
- Modify: `app/src/pages/games.astro`

- [ ] **Step 1: Update `index.astro`**

```astro
---
import AppLayout from "@layouts/AppLayout.astro";
import Card from "@components/ui/Card.astro";
import GameCard from "@components/games/GameCard.astro";
import { getQuickStartGames } from "@lib/server/data/games";
import { getSession } from "@lib/server/auth/session";

const session = await getSession(Astro.cookies);
const userId = session.username ?? "default";
let quickStartGames = [];

try {
  quickStartGames = await getQuickStartGames(userId, 2);
} catch {
  quickStartGames = [];
}
---

<AppLayout>
  <main class="mx-auto w-full max-w-2xl flex-1 p-4 @sm:p-6 space-y-12">
    <!-- Statistics section unchanged -->
    <section class="grid grid-cols-2 gap-x-4 gap-y-6">
      <article class="col-span-2 space-y-2">
        <div class="flex justify-between items-center gap-4">
          <h2 class="text-text-muted text-2xl font-semibold shrink-0">Quick Start</h2>
          <div class="bg-text-muted/20 pt-px w-full"></div>
        </div>
        <p class="text-text-muted text-sm">
          Select one of your favorite games to get started.
        </p>
      </article>
      {quickStartGames.map((game) => <GameCard game={game} />)}
    </section>
  </main>
</AppLayout>
```

Keep existing Statistics section markup from current `index.astro`.

- [ ] **Step 2: Update `games.astro`**

```astro
---
import AppLayout from "@layouts/AppLayout.astro";
import GameCard from "@components/games/GameCard.astro";
import Toast from "@components/games/Toast.astro";
import { getGameTypes } from "@lib/server/data/games";

let games = [];

try {
  games = await getGameTypes();
} catch {
  games = [];
}
---

<AppLayout>
  <main class="mx-auto w-full max-w-2xl flex-1 p-4 @sm:p-6">
    <header class="mb-6 space-y-1">
      <p class="text-text-muted text-sm">Select a game to get started.</p>
      <div class="flex flex-col gap-4 mt-4">
        {games.map((game) => <GameCard game={game} />)}
      </div>
    </header>
  </main>
  <Toast />
</AppLayout>
```

- [ ] **Step 3: Run full verification**

Run: `npm run check && npm test && npm run build`
Expected: PASS

- [ ] **Step 4: Manual smoke test** (with `netlify dev` from repo root, logged in)

1. `/games` — 3 games listed
2. `/` — 2 Quick Start games
3. Click `501` → settings page with starting score input
4. Start playing → `/games/501` play placeholder
5. Visit `/games/invalid` → redirect, toast, URL cleans to `/games`
6. Play `501` again → Quick Start reflects `501` as top game

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/pages/games.astro
git commit -m "feat: wire home quick start and games list to game routing"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `/games/settings-{slug}` config route | Task 11 |
| `/games/{slug}` play route | Task 11 |
| Blob-backed catalog + config + stats | Task 4 |
| Component registry (`SettingsForm` + `Play`) | Task 5, 10 |
| Unknown slug redirect + toast | Task 7, 11 |
| URL cleanup after toast dismiss | Task 7 |
| Quick Start with stats fallback | Task 4, 12 |
| Full games list | Task 12 |
| API routes | Task 6 |
| Session user identity | Task 3 |
| Three prototype games | Task 4 (seed), Task 10 |
| Tests per spec section 9 | Tasks 1–8 |

No gaps found.
