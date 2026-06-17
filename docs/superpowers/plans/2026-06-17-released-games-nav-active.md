# Released Games & Bottom Nav Active State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
> 1. **test-driven-development** — for any task that writes or changes code
> 2. **verification-before-completion** — run the per-task verification gate before marking the task done; no completion claims without fresh command output
> 3. **NEVER commit** — do not run `git add`, `git commit`, or `git push` at any point. The controller commits after review.
>
> A task is **not complete** until its verification gate passes with evidence recorded in the subagent's final report.

**Goal:** Show only released games (`ten-up-one-down`, `score-training`) on `/games` and Quick Start; reconcile stale blob catalogs; fix BottomNav active-tab highlighting on nested `/games` routes.

**Architecture:** Add `released: boolean` to `GameType` and `SEED_GAMES`. `readCatalog()` reconciles stored blob entries with seed metadata on every read. `getGameTypes()` filters `enabled && released`. Extract `isNavActive()` for testable nav matching; `NavBtn` uses optional `matchPrefix` and conditional active classes.

**Tech Stack:** Astro 6, Tailwind CSS 4, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-06-17-released-games-nav-active-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

---

## Verification Gate (every task)

**Iron law:** No completion claims without fresh verification evidence from this session.

### 1. Static analysis (required every task)

```bash
npm run check
```

**Required output tail (all three must be 0):**

```
Result (N files):
- 0 errors
- 0 warnings
- 0 hints
```

### 2. Tests (required every task that adds/changes code)

```bash
npm test
```

Required: exit code 0, 0 failures. Run scoped tests during development; full suite before reporting task complete.

### Dispatcher handoff prompt

```
REQUIRED SUB-SKILLS: test-driven-development (code tasks), verification-before-completion (always).
NEVER COMMIT — do not git add, git commit, or git push.
Before reporting task complete: run npm run check (0/0/0) and npm test (0 failures).
Include fresh command output as evidence. Do not claim success without it.
```

---

## Final Verification Gate (after all tasks)

Run only after Task 4 is complete. REQUIRED SUB-SKILL: verification-before-completion.

```bash
cd app
npm run check
npm test
npm run build
```

All three must exit 0. Paste full output tails as evidence.

---

## File Structure Overview

| File | Responsibility |
|------|----------------|
| `src/lib/shared/games/types.ts` | `released` on `GameType`; updated `SEED_GAMES` |
| `src/lib/server/data/games.ts` | `reconcileCatalog()`, released filter in getters |
| `src/lib/shared/nav/is-nav-active.ts` | Pure nav active-state function |
| `src/components/layout/NavBtn.astro` | `matchPrefix` prop; conditional active classes |
| `src/components/layout/BottomNav.astro` | `matchPrefix="/games"` on Games tab |
| `tests/lib/shared/games/types.test.ts` | `released` assertions on seed entries |
| `tests/lib/server/data/games.test.ts` | Reconciliation, released filter, quick-start pool |
| `tests/lib/shared/nav/is-nav-active.test.ts` | Prefix + exact match cases |

---

### Task 1: `released` flag on GameType and SEED_GAMES

**Files:**
- Modify: `app/src/lib/shared/games/types.ts`
- Modify: `app/tests/lib/shared/games/types.test.ts`

- [ ] **Step 1: Write the failing types test**

Replace `app/tests/lib/shared/games/types.test.ts` with:

```typescript
import { describe, it, expect } from "vitest";
import { SEED_GAMES } from "@lib/shared/games/types";

describe("SEED_GAMES", () => {
  it("includes score-training as released", () => {
    expect(SEED_GAMES).toContainEqual({
      slug: "score-training",
      displayName: "Score Training",
      sortOrder: 4,
      enabled: true,
      released: true,
    });
  });

  it("marks placeholder games as unreleased", () => {
    const placeholders = SEED_GAMES.filter((g) =>
      ["501", "121"].includes(g.slug)
    );
    expect(placeholders).toHaveLength(2);
    expect(placeholders.every((g) => g.released === false)).toBe(true);
  });

  it("marks ten-up-one-down as released", () => {
    const game = SEED_GAMES.find((g) => g.slug === "ten-up-one-down");
    expect(game?.released).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/types.test.ts`

Expected: FAIL — `released` property missing or undefined

- [ ] **Step 3: Add `released` to GameType and SEED_GAMES**

Replace `app/src/lib/shared/games/types.ts` with:

```typescript
export type GameType = {
  slug: string;
  displayName: string;
  sortOrder: number;
  enabled: boolean;
  released: boolean;
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
  { slug: "501", displayName: "501", sortOrder: 1, enabled: true, released: false },
  {
    slug: "ten-up-one-down",
    displayName: "Ten Up One Down",
    sortOrder: 2,
    enabled: true,
    released: true,
  },
  { slug: "121", displayName: "121", sortOrder: 3, enabled: true, released: false },
  {
    slug: "score-training",
    displayName: "Score Training",
    sortOrder: 4,
    enabled: true,
    released: true,
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/types.test.ts`

Expected: PASS (3 tests)

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

Expected: `0 errors`, `0 warnings`, `0 hints`; all tests pass (some games.test.ts expectations may still be stale — fixed in Task 2)

**Do not commit.**

---

### Task 2: Catalog reconciliation and released filter

**Files:**
- Modify: `app/src/lib/server/data/games.ts`
- Modify: `app/tests/lib/server/data/games.test.ts`

- [ ] **Step 1: Write failing reconciliation test**

Add to `app/tests/lib/server/data/games.test.ts` (keep existing imports/mocks; update tests as shown):

At top, after existing imports, add helper:

```typescript
const RELEASED_GAMES = SEED_GAMES.filter((g) => g.released);
```

Replace the `seeds catalog when store is empty` test body:

```typescript
  it("seeds catalog when store is empty", async () => {
    mockGet.mockResolvedValue(null);
    const games = await getGameTypes();
    expect(games).toEqual(RELEASED_GAMES);
    expect(mockSetJSON).toHaveBeenCalledWith("game-types", "catalog", SEED_GAMES);
  });
```

Add new tests before the closing `});` of the describe block:

```typescript
  it("reconciles stale catalog missing score-training", async () => {
    const staleCatalog = SEED_GAMES.filter((g) => g.slug !== "score-training");
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(staleCatalog);
      return Promise.resolve(null);
    });

    const games = await getGameTypes();

    expect(games.map((g) => g.slug)).toContain("score-training");
    expect(mockSetJSON).toHaveBeenCalledWith("game-types", "catalog", SEED_GAMES);
    expect(games).toEqual(RELEASED_GAMES);
  });

  it("reconciliation is idempotent when catalog already matches seed", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });

    await getGameTypes();
    expect(mockSetJSON).not.toHaveBeenCalled();
  });

  it("getGameTypes returns only released games", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    const games = await getGameTypes();
    expect(games.map((g) => g.slug)).toEqual([
      "ten-up-one-down",
      "score-training",
    ]);
  });

  it("getGameBySlug returns null for unreleased game", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    await expect(getGameBySlug("501")).resolves.toBeNull();
  });
```

Update existing tests:

Replace `getGameBySlug returns enabled game` with:

```typescript
  it("getGameBySlug returns released game", async () => {
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      return Promise.resolve(null);
    });
    const game = await getGameBySlug("ten-up-one-down");
    expect(game?.slug).toBe("ten-up-one-down");
  });
```

Update `getGameBySlug returns score-training from catalog` expected object to include `released: true`.

Update `getQuickStartGames falls back to first N when no stats`:

```typescript
    expect(games.map((g) => g.slug)).toEqual(["ten-up-one-down", "score-training"]);
```

Update `getQuickStartGames sorts by play count when stats exist` — use released slugs only:

```typescript
    mockGet.mockImplementation((store: string, key: string) => {
      if (store === "game-types" && key === "catalog") return Promise.resolve(SEED_GAMES);
      if (store === "user-game-stats" && key === "alex") {
        return Promise.resolve({
          playCounts: { "score-training": 5, "ten-up-one-down": 2 },
        });
      }
      return Promise.resolve(null);
    });
    const games = await getQuickStartGames("alex", 2);
    expect(games.map((g) => g.slug)).toEqual(["score-training", "ten-up-one-down"]);
```

- [ ] **Step 2: Run tests to verify failures**

Run: `cd app && npm test -- tests/lib/server/data/games.test.ts`

Expected: FAIL on new reconciliation / released-filter tests

- [ ] **Step 3: Implement reconciliation and released filter**

Replace `app/src/lib/server/data/games.ts` with:

```typescript
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

/**
 * Merge stored catalog with SEED_GAMES metadata by slug.
 * Seed entries win on conflict; unknown stored entries are preserved at the end.
 */
export function reconcileCatalog(stored: GameType[]): GameType[] {
  const bySlug = new Map(stored.map((game) => [game.slug, game]));
  const seedSlugs = new Set(SEED_GAMES.map((game) => game.slug));

  for (const seed of SEED_GAMES) {
    bySlug.set(seed.slug, { ...bySlug.get(seed.slug), ...seed });
  }

  const merged = [
    ...SEED_GAMES.map((seed) => bySlug.get(seed.slug)!),
    ...stored.filter((game) => !seedSlugs.has(game.slug)),
  ];

  return merged;
}

function catalogsEqual(a: GameType[], b: GameType[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isVisibleGame(game: GameType): boolean {
  return game.enabled && game.released;
}

async function readCatalog(): Promise<GameType[]> {
  const store = getStore(CATALOG_STORE);
  const data = await store.get(CATALOG_KEY, { type: "json" });
  if (!data) {
    await store.setJSON(CATALOG_KEY, SEED_GAMES);
    return SEED_GAMES;
  }

  const stored = data as GameType[];
  const merged = reconcileCatalog(stored);
  if (!catalogsEqual(merged, stored)) {
    await store.setJSON(CATALOG_KEY, merged);
  }
  return merged;
}

/**
 * Return all released, enabled game types sorted by sortOrder.
 */
export async function getGameTypes(): Promise<GameType[]> {
  const catalog = await readCatalog();
  return catalog
    .filter(isVisibleGame)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Look up a single released, enabled game by slug.
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

  const hasPlays = catalog.some(
    (game) => (stats.playCounts[game.slug] ?? 0) > 0
  );
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

Note: `getQuickStartGames` `hasPlays` now checks only released catalog slugs (not unreleased play counts in stats).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- tests/lib/server/data/games.test.ts`

Expected: PASS (all games data layer tests)

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

Expected: `0 errors`, `0 warnings`, `0 hints`; all tests pass

**Do not commit.**

---

### Task 3: `isNavActive` utility

**Files:**
- Create: `app/src/lib/shared/nav/is-nav-active.ts`
- Create: `app/tests/lib/shared/nav/is-nav-active.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/shared/nav/is-nav-active.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isNavActive } from "@lib/shared/nav/is-nav-active";

describe("isNavActive", () => {
  it("matches home exactly", () => {
    expect(isNavActive("/", "/", undefined)).toBe(true);
    expect(isNavActive("/games", "/", undefined)).toBe(false);
  });

  it("matches games list and nested routes via prefix", () => {
    expect(isNavActive("/games", "/games", "/games")).toBe(true);
    expect(isNavActive("/games/score-training", "/games", "/games")).toBe(true);
    expect(
      isNavActive("/games/settings-ten-up-one-down", "/games", "/games")
    ).toBe(true);
  });

  it("does not match home for games paths", () => {
    expect(isNavActive("/games", "/", undefined)).toBe(false);
  });

  it("matches statistics exactly", () => {
    expect(isNavActive("/statistics", "/statistics", undefined)).toBe(true);
    expect(isNavActive("/statistics/foo", "/statistics", undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/nav/is-nav-active.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement isNavActive**

Create `app/src/lib/shared/nav/is-nav-active.ts`:

```typescript
/**
 * Returns whether a nav item should appear active for the current pathname.
 */
export function isNavActive(
  pathname: string,
  href: string,
  matchPrefix?: string
): boolean {
  if (pathname === href) return true;
  if (matchPrefix != null && pathname.startsWith(matchPrefix)) return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/nav/is-nav-active.test.ts`

Expected: PASS (4 tests)

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

Expected: `0 errors`, `0 warnings`, `0 hints`; all tests pass

**Do not commit.**

---

### Task 4: NavBtn and BottomNav active state

**Files:**
- Modify: `app/src/components/layout/NavBtn.astro`
- Modify: `app/src/components/layout/BottomNav.astro`

- [ ] **Step 1: Update NavBtn to use isNavActive and conditional classes**

Replace `app/src/components/layout/NavBtn.astro` with:

```astro
---
import { isNavActive } from "@lib/shared/nav/is-nav-active";

interface Props {
  href: string;
  matchPrefix?: string;
}

const { href, matchPrefix }: Props = Astro.props;
const baseClassName =
  "icon-btn-hover btn-press inline-flex items-center justify-center rounded-md p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&_svg]:block [&_svg]:size-6";
const active = isNavActive(Astro.url.pathname, href, matchPrefix);
const className = active
  ? `${baseClassName} text-accent`
  : `${baseClassName} nav-link-inactive`;
---

<a href={href} class={className}>
  <slot />
</a>
```

- [ ] **Step 2: Pass matchPrefix to Games NavBtn**

Replace `app/src/components/layout/BottomNav.astro` with:

```astro
---
// Components
import NavBtn from "@components/layout/NavBtn.astro";

// Icons
import homeIcon from "@icons/home.svg?raw";
import statsIcon from "@icons/stats.svg?raw";
import dartsIcon from "@icons/darts.svg?raw";
---

<nav class="grid grid-cols-3 border-t border-border p-4">
  <NavBtn href="/">
    <span set:html={homeIcon} />
  </NavBtn>
  <NavBtn href="/games" matchPrefix="/games">
    <span set:html={dartsIcon} />
  </NavBtn>
  <NavBtn href="/statistics">
    <span set:html={statsIcon} />
  </NavBtn>
</nav>
```

- [ ] **Step 3: Run verification gate**

Run: `cd app && npm run check && npm test && npm run build`

Expected: all three exit 0

**Do not commit.**

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| `released` on `GameType` + SEED_GAMES values | Task 1 |
| Catalog reconciliation on read | Task 2 |
| `getGameTypes` filters `enabled && released` | Task 2 |
| `getGameBySlug` returns null for unreleased | Task 2 |
| `getQuickStartGames` uses released pool only | Task 2 |
| `isNavActive` prefix + exact match | Task 3 |
| NavBtn `matchPrefix` + conditional classes | Task 4 |
| BottomNav Games `matchPrefix="/games"` | Task 4 |
