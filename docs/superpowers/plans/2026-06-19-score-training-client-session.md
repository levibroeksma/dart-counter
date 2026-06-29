# Score Training Client Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
>
> 1. **test-driven-development** — for any task that writes or changes code
> 2. **verification-before-completion** — run the per-task verification gate before marking the task done; no completion claims without fresh command output
> 3. **NEVER commit** — do not run `git add`, `git commit`, or `git push` at any point
>
> A task is **not complete** until its verification gate passes with evidence recorded in the subagent's final report.

**Goal:** Eliminate score-training active session DB usage; hold in-game state in Alpine; validate settings via form POST; persist stats and play count only on completion; show static skeleton shells until Alpine `ready` and during completion API fetch.

**Architecture:** Shared helpers parse form data, build initial session, and validate completed sessions. Play page handles POST for score-training start. In-progress state held in Alpine `$persist(...).using(sessionStorage)` (survives refresh, cleared on leave/completion). Alpine play controller applies rounds locally with a `ready` gate that swaps skeleton placeholders for live UI. Single completion API writes stats + play count; `SummarySkeleton` covers the API wait.

**Tech Stack:** Astro 6, Alpine.js 3, `@alpinejs/persist`, TypeScript, Vitest, Drizzle/Neon Postgres

**Spec:** `docs/superpowers/specs/2026-06-19-score-training-client-session-design.md`
**Working directory:** `app/` (all commands run from here unless noted)

---

## Codebase & Dev Environment (re-analysed 2026-06-19)

**Implementation status:** Plan not started. Score Training still uses DB-backed `game_sessions` + per-round API routes. No `form-data.ts`, `session-factory.ts`, `completion.ts`, skeleton components, or `@alpinejs/persist` yet.

**Dev database workflow (new since plan draft):**

| Piece | Behaviour | Impact on this plan |
| ----- | --------- | ------------------- |
| `npm run dev` | Runs `ensure-neon-dev-branch.ts` → per-git-branch Neon branch, `neonctl env pull` → `.env.local`, migrations, `ensureNeonAuthUser` | Subagents run `npm test` / `npm run check` only — no Neon branch required for unit tests |
| `bootstrapEnv()` | Loads `.env`, re-applies `.env.local` on every call so dev credentials win | `db/index.ts` and auth call this; irrelevant to mocked API tests |
| `entry_env` column | All user-scoped rows (`game_sessions`, `player_score_training_stats`, `user_game_play_counts`) scoped by `getEntryEnv()` (`dev` locally, `prod` in production) | **Completion API unchanged in intent:** `incrementPlayCount` and stats helpers already pass `entryEnv: getEntryEnv()` internally |
| `vitest.config.ts` | Sets `ENTRY_ENV: "dev"` | Any remaining data-layer tests use `TEST_ENTRY_ENV` via `mock-db` |

**What still applies unchanged:**

- Remove `score-training-session.ts` and session/round API routes (score-training only).
- Move `incrementPlayCount` off play-page GET for score-training; call from new `/api/games/score-training/complete` via existing `incrementPlayCount()` helper.
- Other games (ten-up-one-down, singles-training) keep DB session pattern + `entry_env` scoping — do not touch.

**No plan task reordering needed.** Add `GAME_NOT_COMPLETE` to `errors.constants.ts` in Task 6 (not present yet). Task 7 completion tests must mock `@lib/server/data/games` `incrementPlayCount` (already in plan).

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

Run only after Task 11 is complete. REQUIRED SUB-SKILL: verification-before-completion.

```bash
cd app
npm run check
npm test
npm run build
npx fallow
```

All four must exit 0. Paste full output tails as evidence.

### Fallow cleanup (dead code + orphan types)

`npx fallow` finds unused exports, dependencies, and types. **Do not auto-delete every finding** — verify each one before removing.

**Double-verify checklist:**

1. Cross-check with `rg` for string/dynamic references (Astro `entrypoint`, `import()`, route filenames).
2. Confirm the symbol is not registered indirectly (Alpine `Alpine.data(...)`, API route file paths, Drizzle schema).
3. Only remove code/types after both fallow **and** `npm run check` + `npm test` + `npm run build` pass.

**Known false positive — do NOT delete:**

`src/lib/client/alpine/app.factory.ts` may appear unused. It **is** used — wired as the Alpine entrypoint in `astro.config.mjs`:

```js
alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" })
```

It is also listed in `.fallowrc.json` → `dynamicallyLoaded`. If fallow still flags it, ignore that finding.

After removing genuine dead code from fallow output, re-run the full gate until `npx fallow` is clean (aside from the known `app.factory.ts` false positive above).

---

## File Structure Overview

| File                                                                   | Responsibility                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/shared/games/score-training/form-data.ts`                     | Parse settings FormData (playtimeMinutes → playtimeSeconds)            |
| `src/lib/shared/games/score-training/session-factory.ts`               | Build in-memory initial session from validated settings                |
| `src/lib/shared/games/score-training/completion.ts`                    | Validate completed session payload for API                             |
| `src/lib/client/alpine/app.factory.ts`                                 | Register `@alpinejs/persist` plugin                                    |
| `src/pages/api/games/score-training/complete.ts`                       | Sole DB write endpoint (stats + play count)                            |
| `src/pages/games/[game].astro`                                         | POST handler for score-training start; GET renders play shell          |
| `src/pages/games/settings-[game].astro`                                | Remove score-training active session lookup                            |
| `src/components/games/score-training/ScoreTrainingSettingsShell.astro` | Native form POST; remove resume/abandon                                |
| `src/components/ui/Skeleton.astro`                                     | Reusable placeholder primitive (`text` / `bar` / `block`)              |
| `src/styles/global.css`                                                | `.skeleton` utility with pulse + reduced-motion fallback               |
| `src/components/games/score-training/PlayShellSkeleton.astro`          | Full game chrome placeholder until `ready`                             |
| `src/components/games/score-training/ProgressBarSkeleton.astro`        | Progress bar layout placeholder                                        |
| `src/components/games/score-training/ScoreCardSkeleton.astro`          | Score card layout placeholder                                          |
| `src/components/games/score-training/NumberInputPadSkeleton.astro`     | Input pad grid placeholder                                             |
| `src/components/games/score-training/SummarySkeleton.astro`            | Summary stats placeholder during completion API                        |
| `src/components/games/score-training/Play.astro`                       | Skeleton/live swap via `ready` and `showSummary && !summary`            |
| `src/lib/client/alpine/games/score-training.settings.ts`               | Simplified to endMode toggle only                                      |
| `src/lib/client/alpine/games/score-training.play.ts`                   | `ready` flag; `$persist` session; client rounds/undo; completion API   |
| `src/lib/shared/api/types.ts`                                          | Add `ScoreTrainingCompleteSuccess` type                                |

**Delete:**

| File                                                       | Reason                            |
| ---------------------------------------------------------- | --------------------------------- |
| `src/pages/api/games/score-training/session.ts`            | No active session CRUD            |
| `src/pages/api/games/score-training/session/round.ts`      | Rounds are client-side            |
| `src/pages/api/games/score-training/session/round/last.ts` | Undo is client-side               |
| `src/pages/api/games/score-training/session/complete.ts`   | Replaced by top-level complete.ts |
| `src/lib/server/data/score-training-session.ts`            | No active session storage         |
| `tests/lib/server/data/score-training-session.test.ts`     | Data layer removed                |
| `tests/api/games/score-training/session.test.ts`           | Route removed                     |
| `tests/api/games/score-training/round.test.ts`             | Route removed                     |
| `tests/api/games/score-training/round-last.test.ts`        | Route removed                     |

---

### Task 1: Shared Form Data Parser

**Files:**

- Create: `app/src/lib/shared/games/score-training/form-data.ts`
- Test: `app/tests/lib/shared/games/score-training/form-data.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/score-training/form-data.test.ts
import { describe, it, expect } from "vitest";
import { parseScoreTrainingSettingsFormData } from "@lib/shared/games/score-training/form-data";

describe("parseScoreTrainingSettingsFormData", () => {
  it("maps roundCount as number for rounds mode", () => {
    const formData = new FormData();
    formData.set("endMode", "rounds");
    formData.set("roundCount", "10");

    expect(parseScoreTrainingSettingsFormData(formData)).toEqual({
      endMode: "rounds",
      roundCount: 10,
    });
  });

  it("converts playtimeMinutes to playtimeSeconds for timed mode", () => {
    const formData = new FormData();
    formData.set("endMode", "timed");
    formData.set("playtimeMinutes", "10");

    expect(parseScoreTrainingSettingsFormData(formData)).toEqual({
      endMode: "timed",
      playtimeSeconds: 600,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/form-data.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/score-training/form-data.ts

/**
 * Converts score-training settings form fields to validation input.
 */
export function parseScoreTrainingSettingsFormData(
  formData: FormData,
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    if (key === "roundCount") {
      settings[key] = Number(value);
      continue;
    }

    if (key === "playtimeMinutes") {
      settings.playtimeSeconds = Number(value) * 60;
      continue;
    }

    settings[key] = value;
  }

  return settings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/form-data.test.ts`
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 2: Session Factory

**Files:**

- Create: `app/src/lib/shared/games/score-training/session-factory.ts`
- Test: `app/tests/lib/shared/games/score-training/session-factory.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/score-training/session-factory.test.ts
import { describe, it, expect } from "vitest";
import { buildScoreTrainingSession } from "@lib/shared/games/score-training/session-factory";
import { STARTING_SCORE } from "@lib/shared/games/score-training/constants";

describe("buildScoreTrainingSession", () => {
  it("creates an active rounds session with empty history", () => {
    const session = buildScoreTrainingSession({
      endMode: "rounds",
      roundCount: 10,
    });

    expect(session.slug).toBe("score-training");
    expect(session.settings).toEqual({ endMode: "rounds", roundCount: 10 });
    expect(session.state).toEqual({
      currentRound: 1,
      currentScore: STARTING_SCORE,
      status: "active",
      lastScore: null,
    });
    expect(session.roundHistory).toEqual([]);
    expect(session.timeRemainingSeconds).toBeNull();
    expect(session.createdAt).toMatch(/^\d{4}-/);
    expect(session.updatedAt).toMatch(/^\d{4}-/);
  });

  it("sets timeRemainingSeconds for timed mode", () => {
    const session = buildScoreTrainingSession({
      endMode: "timed",
      playtimeSeconds: 600,
    });

    expect(session.timeRemainingSeconds).toBe(600);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/session-factory.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/score-training/session-factory.ts
import { createInitialGameState } from "@lib/shared/games/score-training/state";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";
import type { ScoreTrainingSettings } from "@lib/shared/games/score-training/settings";

/**
 * Builds an in-memory score-training session from validated settings.
 */
export function buildScoreTrainingSession(
  settings: ScoreTrainingSettings,
): ScoreTrainingSession {
  const now = new Date().toISOString();

  return {
    slug: "score-training",
    settings,
    state: createInitialGameState(settings),
    roundHistory: [],
    timeRemainingSeconds:
      settings.endMode === "timed" ? settings.playtimeSeconds : null,
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/session-factory.test.ts`
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 3: Register Alpine Persist Plugin

**Files:**
- Modify: `app/package.json`
- Modify: `app/src/lib/client/alpine/app.factory.ts`
- Test: `app/tests/lib/client/alpine/app.factory.test.ts`

**Purpose:** Enable `$persist(...).using(sessionStorage)` for in-progress session state.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/client/alpine/app.factory.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Alpine app factory", () => {
  it("registers the persist plugin", () => {
    const source = readSource("src/lib/client/alpine/app.factory.ts");
    expect(source).toContain('@alpinejs/persist');
    expect(source).toContain("Alpine.plugin(persist)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/client/alpine/app.factory.test.ts`  
Expected: FAIL

- [ ] **Step 3: Install dependency and register plugin**

```bash
cd app && npm install @alpinejs/persist
```

```typescript
// app/src/lib/client/alpine/app.factory.ts
import type { Alpine } from "alpinejs";
import persist from "@alpinejs/persist";
// ... existing imports

export default (Alpine: Alpine) => {
  Alpine.plugin(persist);

  Alpine.data("loginForm", loginForm);
  // ... rest unchanged
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/client/alpine/app.factory.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 4: Skeleton Primitive + CSS

**Files:**

- Create: `app/src/components/ui/Skeleton.astro`
- Modify: `app/src/styles/global.css`
- Test: `app/tests/components/ui/Skeleton.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/components/ui/Skeleton.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Skeleton.astro", () => {
  it("supports text, bar, and block variants with aria-hidden", () => {
    const source = readSource("src/components/ui/Skeleton.astro");
    expect(source).toContain('"text" | "bar" | "block"');
    expect(source).toContain('class:list={["skeleton"');
    expect(source).toContain('aria-hidden="true"');
  });
});

describe(".skeleton utility", () => {
  it("defines pulse animation and reduced-motion fallback", () => {
    const source = readSource("src/styles/global.css");
    expect(source).toContain(".skeleton");
    expect(source).toContain("prefers-reduced-motion");
    expect(source).toContain("bg-white/10");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/components/ui/Skeleton.test.ts`
Expected: FAIL — module or class not found

- [ ] **Step 3: Write minimal implementation**

```astro
---
// app/src/components/ui/Skeleton.astro
interface Props {
  variant?: "text" | "bar" | "block";
  class?: string;
}

const { variant = "block", class: className = "" } = Astro.props;
const Tag = variant === "text" ? "span" : "div";
const sizeClass =
  variant === "text"
    ? "inline-block h-3 rounded"
    : variant === "bar"
      ? "h-4 rounded"
      : "rounded";
---

<Tag class:list={["skeleton", sizeClass, className]} aria-hidden="true" />
```

Add to `app/src/styles/global.css` inside `@layer components`:

```css
.skeleton {
  @apply bg-white/10 animate-pulse;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/components/ui/Skeleton.test.ts`
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 5: Score Training Skeleton Components

**Files:**

- Create: `app/src/components/games/score-training/ProgressBarSkeleton.astro`
- Create: `app/src/components/games/score-training/ScoreCardSkeleton.astro`
- Create: `app/src/components/games/score-training/NumberInputPadSkeleton.astro`
- Create: `app/src/components/games/score-training/SummarySkeleton.astro`
- Create: `app/src/components/games/score-training/PlayShellSkeleton.astro`
- Test: `app/tests/components/games/score-training/skeletons.test.ts`

**Purpose:** Pure static Astro placeholders matching live component dimensions. No `x-data` or `x-show` inside skeleton files — parent `Play.astro` toggles visibility.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/components/games/score-training/skeletons.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("score-training skeleton components", () => {
  it("ProgressBarSkeleton mirrors game-panel height and uses Skeleton", () => {
    const source = readSource(
      "src/components/games/score-training/ProgressBarSkeleton.astro",
    );
    expect(source).toContain('import Skeleton from "@components/ui/Skeleton.astro"');
    expect(source).toContain("game-panel");
    expect(source).not.toContain("x-data");
  });

  it("ScoreCardSkeleton mirrors h-40 score card layout", () => {
    const source = readSource(
      "src/components/games/score-training/ScoreCardSkeleton.astro",
    );
    expect(source).toContain("h-40");
    expect(source).toContain('data-testid="st-score-card-skeleton"');
  });

  it("NumberInputPadSkeleton renders score row and 4x3 grid", () => {
    const source = readSource(
      "src/components/games/score-training/NumberInputPadSkeleton.astro",
    );
    expect(source).toContain('data-testid="st-number-pad-skeleton"');
    expect(source).toMatch(/grid-cols-4/);
  });

  it("SummarySkeleton renders definition-list row placeholders", () => {
    const source = readSource(
      "src/components/games/score-training/SummarySkeleton.astro",
    );
    expect(source).toContain('data-testid="st-summary-skeleton"');
    expect(source).toContain("grid-cols-2");
  });

  it("PlayShellSkeleton composes region skeletons", () => {
    const source = readSource(
      "src/components/games/score-training/PlayShellSkeleton.astro",
    );
    expect(source).toContain("<ProgressBarSkeleton");
    expect(source).toContain("<ScoreCardSkeleton");
    expect(source).toContain("<NumberInputPadSkeleton");
    expect(source).not.toContain("x-show");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/components/games/score-training/skeletons.test.ts`
Expected: FAIL — files not found

- [ ] **Step 3: Write skeleton components**

```astro
---
// app/src/components/games/score-training/ProgressBarSkeleton.astro
import Skeleton from "@components/ui/Skeleton.astro";
---

<article class="game-panel py-2 px-4 h-fit">
  <div class="flex items-center justify-between gap-3">
    <Skeleton variant="bar" class="h-4 w-2/5" />
    <Skeleton variant="block" class="h-7 w-16 rounded-full" />
  </div>
</article>
```

```astro
---
// app/src/components/games/score-training/ScoreCardSkeleton.astro
import Skeleton from "@components/ui/Skeleton.astro";
---

<article class="game-panel p-3 h-40" data-testid="st-score-card-skeleton">
  <div class="flex items-center justify-center flex-col gap-4">
    <div class="flex items-center justify-center flex-col gap-2 w-full">
      <Skeleton variant="text" class="h-3 w-28" />
      <Skeleton variant="block" class="h-10 w-24" />
    </div>
    <div class="flex items-center justify-center gap-4 w-full">
      <Skeleton variant="text" class="h-3 w-16" />
      <Skeleton variant="text" class="h-3 w-16" />
      <Skeleton variant="text" class="h-3 w-16" />
    </div>
  </div>
</article>
```

```astro
---
// app/src/components/games/score-training/NumberInputPadSkeleton.astro
import Skeleton from "@components/ui/Skeleton.astro";
---

<div data-testid="st-number-pad-skeleton" class="flex flex-col flex-1 gap-3">
  <Skeleton variant="block" class="h-10 w-full rounded-md" />
  <div class="grid grid-cols-4 gap-2 flex-1">
    {Array.from({ length: 12 }).map(() => (
      <Skeleton variant="block" class="aspect-square w-full" />
    ))}
  </div>
</div>
```

```astro
---
// app/src/components/games/score-training/SummarySkeleton.astro
import Skeleton from "@components/ui/Skeleton.astro";
---

<article class="game-panel p-6 flex flex-col gap-4" data-testid="st-summary-skeleton">
  <Skeleton variant="bar" class="h-6 w-40" />
  <dl class="grid grid-cols-2 gap-3">
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
  </dl>
  <Skeleton variant="block" class="h-10 w-full rounded-full" />
</article>
```

```astro
---
// app/src/components/games/score-training/PlayShellSkeleton.astro
import ProgressBarSkeleton from "./ProgressBarSkeleton.astro";
import ScoreCardSkeleton from "./ScoreCardSkeleton.astro";
import NumberInputPadSkeleton from "./NumberInputPadSkeleton.astro";
---

<div class="flex flex-col gap-4 flex-1">
  <ProgressBarSkeleton />
  <ScoreCardSkeleton />
  <article class="game-panel flex-1 p-4 flex flex-col">
    <NumberInputPadSkeleton />
  </article>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/components/games/score-training/skeletons.test.ts`
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 6: Completed Session Validator

**Files:**

- Create: `app/src/lib/shared/games/score-training/completion.ts`
- Test: `app/tests/lib/shared/games/score-training/completion.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/score-training/completion.test.ts
import { describe, it, expect } from "vitest";
import { validateCompletedScoreTrainingSession } from "@lib/shared/games/score-training/completion";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildScoreTrainingSession } from "@lib/shared/games/score-training/session-factory";
import { applyRoundToState } from "@lib/shared/games/score-training/state";
import { buildRoundRecord } from "@lib/shared/games/score-training/round";

describe("validateCompletedScoreTrainingSession", () => {
  it("accepts a legitimately completed rounds session", () => {
    let session = buildScoreTrainingSession({
      endMode: "rounds",
      roundCount: 2,
    });

    for (let i = 0; i < 2; i++) {
      const round = buildRoundRecord(
        session.state.currentRound,
        60,
        session.state.currentScore,
      );
      session.state = applyRoundToState(session.state, round, session.settings);
      session.roundHistory.push(round);
    }

    const result = validateCompletedScoreTrainingSession(session);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.state.status).toBe("completed");
    }
  });

  it("rejects incomplete session", () => {
    const session = buildScoreTrainingSession({
      endMode: "rounds",
      roundCount: 10,
    });
    const result = validateCompletedScoreTrainingSession(session);
    expect(result).toEqual({
      valid: false,
      code: MessageCode.GAME_NOT_COMPLETE,
    });
  });

  it("rejects tampered running totals", () => {
    let session = buildScoreTrainingSession({
      endMode: "rounds",
      roundCount: 1,
    });
    const round = buildRoundRecord(1, 60, session.state.currentScore);
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push({ ...round, runningTotal: 999 });

    const result = validateCompletedScoreTrainingSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_ROUND });
  });

  it("rejects invalid shape", () => {
    const result = validateCompletedScoreTrainingSession({ slug: "501" });
    expect(result).toEqual({
      valid: false,
      code: MessageCode.INVALID_GAME_SETTINGS,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/completion.test.ts`
Expected: FAIL — may also fail on missing `MessageCode.GAME_NOT_COMPLETE`

- [ ] **Step 3: Add message code if missing**

In `app/src/lib/shared/constants/errors.constants.ts`, add:

```typescript
GAME_NOT_COMPLETE = "GAME_NOT_COMPLETE",
```

Add i18n entry in the errors translation map if the project maps codes to strings.

- [ ] **Step 4: Write minimal implementation**

```typescript
// app/src/lib/shared/games/score-training/completion.ts
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  isScoreTrainingSession,
  type ScoreTrainingSession,
} from "@lib/shared/games/score-training/session";
import { validateRoundRecord } from "@lib/shared/games/score-training/round";
import { validateScoreTrainingSettings } from "@lib/shared/games/score-training/validation";
import { STARTING_SCORE } from "@lib/shared/games/score-training/constants";

export type ValidateCompletedResult =
  | { valid: true; value: ScoreTrainingSession }
  | {
      valid: false;
      code:
        | typeof MessageCode.INVALID_GAME_SETTINGS
        | typeof MessageCode.GAME_NOT_COMPLETE
        | typeof MessageCode.INVALID_ROUND;
    };

/**
 * Validates a client-submitted completed score-training session.
 */
export function validateCompletedScoreTrainingSession(
  raw: unknown,
): ValidateCompletedResult {
  if (!isScoreTrainingSession(raw)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const session = raw;
  const settingsCheck = validateScoreTrainingSettings(
    session.settings as unknown as Record<string, unknown>,
  );
  if (!settingsCheck.valid) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  if (session.state.status !== "completed") {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  let expectedRound = 1;
  let runningTotal = STARTING_SCORE;

  for (const round of session.roundHistory) {
    const roundCheck = validateRoundRecord(round, expectedRound);
    if (!roundCheck.valid) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }

    runningTotal += round.visitScore;
    if (round.runningTotal !== runningTotal) {
      return { valid: false, code: MessageCode.INVALID_ROUND };
    }

    expectedRound += 1;
  }

  if (session.state.currentRound !== expectedRound) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }

  if (session.state.currentScore !== runningTotal) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }

  const lastRound = session.roundHistory[session.roundHistory.length - 1];
  if (session.state.lastScore !== (lastRound?.visitScore ?? null)) {
    return { valid: false, code: MessageCode.INVALID_ROUND };
  }

  if (settingsCheck.value.endMode === "rounds") {
    if (session.roundHistory.length !== settingsCheck.value.roundCount) {
      return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
    }
  }

  return { valid: true, value: session };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/score-training/completion.test.ts`
Expected: PASS

- [ ] **Step 6: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 7: Completion API

**Files:**

- Create: `app/src/pages/api/games/score-training/complete.ts`
- Modify: `app/src/lib/shared/api/types.ts`
- Test: `app/tests/api/games/score-training/complete.test.ts` (replace existing)

- [ ] **Step 1: Write the failing test**

Replace `app/tests/api/games/score-training/complete.test.ts` with:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../../src/pages/api/games/score-training/complete";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptyScoreTrainingStats } from "@lib/shared/games/score-training/stats";
import { buildScoreTrainingSession } from "@lib/shared/games/score-training/session-factory";
import { applyRoundToState } from "@lib/shared/games/score-training/state";
import { buildRoundRecord } from "@lib/shared/games/score-training/round";

const mockGetSession = vi.fn();
const mockGetPlayerScoreTrainingStats = vi.fn();
const mockSavePlayerScoreTrainingStats = vi.fn();
const mockIncrementPlayCount = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/player-score-training-stats", () => ({
  getPlayerScoreTrainingStats: (...args: unknown[]) =>
    mockGetPlayerScoreTrainingStats(...args),
  savePlayerScoreTrainingStats: (...args: unknown[]) =>
    mockSavePlayerScoreTrainingStats(...args),
}));

vi.mock("@lib/server/data/games", () => ({
  incrementPlayCount: (...args: unknown[]) => mockIncrementPlayCount(...args),
}));

function buildCompletedRoundsSession() {
  let session = buildScoreTrainingSession({ endMode: "rounds", roundCount: 2 });
  for (let i = 0; i < 2; i++) {
    const round = buildRoundRecord(
      session.state.currentRound,
      60,
      session.state.currentScore,
    );
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);
  }
  return session;
}

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/score-training/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/score-training/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      userId: "00000000-0000-4000-8000-000000000001",
    });
    mockGetPlayerScoreTrainingStats.mockResolvedValue(
      createEmptyScoreTrainingStats(),
    );
    mockSavePlayerScoreTrainingStats.mockResolvedValue(undefined);
    mockIncrementPlayCount.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });
    const response = await POST(createContext(buildCompletedRoundsSession()));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 400 for incomplete session", async () => {
    const response = await POST(
      createContext(
        buildScoreTrainingSession({ endMode: "rounds", roundCount: 10 }),
      ),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.GAME_NOT_COMPLETE,
    });
  });

  it("saves stats, increments play count, and returns summary", async () => {
    const session = buildCompletedRoundsSession();
    const response = await POST(createContext(session));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.summary).toEqual({
      totalScore: 120,
      threeDartAverage: 60,
      roundsPlayed: 2,
      dartsThrown: 6,
    });
    expect(mockSavePlayerScoreTrainingStats).toHaveBeenCalledTimes(1);
    expect(mockIncrementPlayCount).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "score-training",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/api/games/score-training/complete.test.ts`
Expected: FAIL — wrong import path or missing route

- [ ] **Step 3: Add API type**

In `app/src/lib/shared/api/types.ts`, add:

```typescript
export type ScoreTrainingCompleteSuccess = {
  ok: true;
  summary: ScoreTrainingSummary;
};
```

Add to `ApiSuccess` union.

- [ ] **Step 4: Write completion route**

`incrementPlayCount` and stats persistence use `getEntryEnv()` inside the data layer — no `entry_env` handling needed in the route itself. Vitest sets `ENTRY_ENV=dev` globally.

```typescript
// app/src/pages/api/games/score-training/complete.ts
import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { validateCompletedScoreTrainingSession } from "@lib/shared/games/score-training/completion";
import { buildSummary } from "@lib/shared/games/score-training/summary";
import { applyGameCompletionToStats } from "@lib/shared/games/score-training/stats";
import { getSession } from "@lib/server/auth/session";
import { incrementPlayCount } from "@lib/server/data/games";
import {
  getPlayerScoreTrainingStats,
  savePlayerScoreTrainingStats,
} from "@lib/server/data/player-score-training-stats";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const auth = await getSession(request);
  if (!auth.isLoggedIn || !auth.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.MISSING_FIELDS }, 400);
  }

  const sessionPayload =
    payload && typeof payload === "object" && "session" in payload
      ? (payload as { session: unknown }).session
      : payload;

  const validated = validateCompletedScoreTrainingSession(sessionPayload);
  if (!validated.valid) {
    return jsonResponse({ ok: false, code: validated.code }, 400);
  }

  try {
    const summary = buildSummary(validated.value);
    const stats = await getPlayerScoreTrainingStats(auth.userId);
    applyGameCompletionToStats(stats, validated.value);
    await savePlayerScoreTrainingStats(auth.userId, stats);
    await incrementPlayCount(auth.userId, "score-training");
    return jsonResponse({ ok: true, summary }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npm test -- tests/api/games/score-training/complete.test.ts`
Expected: PASS

- [ ] **Step 6: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 8: Alpine Play Controller (`ready` + Skeleton Swap)

**Files:**

- Modify: `app/src/lib/client/alpine/games/score-training.play.ts`
- Modify: `app/src/components/games/score-training/Play.astro`
- Modify: `app/src/components/games/score-training/Summary.astro` (optional `showSummaryModel` override only)
- Test: `app/tests/lib/client/alpine/games/score-training.play.test.ts`
- Test: `app/tests/pages/score-training-play-assembly.test.ts` (skeleton wiring assertions)

- [ ] **Step 1: Write failing play tests for `ready` and summary skeleton gap**

```typescript
// app/tests/lib/client/alpine/games/score-training.play.test.ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Alpine from "alpinejs";
import persist from "@alpinejs/persist";
import {
  clearPersistedScoreTrainingSession,
  SCORE_TRAINING_SESSION_KEY,
  scoreTrainingPlay,
} from "@lib/client/alpine/games/score-training.play";

const roundsSession = {
  slug: "score-training" as const,
  settings: { endMode: "rounds" as const, roundCount: 2 },
  state: {
    currentRound: 1,
    currentScore: 0,
    status: "active" as const,
    lastScore: null,
  },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

function persistStorageKey(): string {
  return Alpine.prefixed(SCORE_TRAINING_SESSION_KEY);
}

beforeEach(() => {
  sessionStorage.clear();
  Alpine.plugin(persist);
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
    configurable: true,
  });
});

it("starts with ready false and sets ready true after init with session", () => {
  const play = scoreTrainingPlay(structuredClone(roundsSession));
  expect(play.ready).toBe(false);
  play.init();
  expect(play.ready).toBe(true);
});

it("redirects before ready when no server session and no persist value", () => {
  const play = scoreTrainingPlay(null);
  play.init();
  expect(play.ready).toBe(false);
  expect(window.location.href).toContain("/games/settings-score-training");
});

it("applies round locally without fetch and $persist auto-syncs", async () => {
  const play = scoreTrainingPlay(structuredClone(roundsSession));
  play.init();
  play.score = "60";
  await play.submitScore();
  expect(fetch).not.toHaveBeenCalled();
  expect(play.session.roundHistory).toHaveLength(1);
  expect(JSON.parse(sessionStorage.getItem(persistStorageKey())!).roundHistory).toHaveLength(1);
});

it("shows summary skeleton gap during completion fetch", async () => {
  let resolveJson!: (value: unknown) => void;
  vi.mocked(fetch).mockReturnValue(
    new Promise((resolve) => {
      resolveJson = (value) =>
        resolve({ json: async () => value } as Response);
    }),
  );

  const play = scoreTrainingPlay(structuredClone(roundsSession));
  play.init();
  play.session.state.status = "completed";
  const completionPromise = play.persistCompletion();

  expect(play.showSummary).toBe(true);
  expect(play.summary).toBeNull();

  resolveJson({
    ok: true,
    summary: {
      totalScore: 60,
      threeDartAverage: 60,
      roundsPlayed: 1,
      dartsThrown: 3,
    },
  });
  await completionPromise;

  expect(play.summary).not.toBeNull();
  expect(sessionStorage.getItem(persistStorageKey())).toBeNull();
});

it("clears $persist storage on confirmed leave", () => {
  const play = scoreTrainingPlay(structuredClone(roundsSession));
  play.init();
  play.confirmLeave();
  expect(sessionStorage.getItem(persistStorageKey())).toBeNull();
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

Merge with any existing display-getter tests in the same file; remove tests that assert round/undo API `fetch` calls.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/client/alpine/games/score-training.play.test.ts`
Expected: FAIL — `ready` undefined or fetch still called on submit

- [ ] **Step 3: Refactor play controller with `ready` gate**

```typescript
// app/src/lib/client/alpine/games/score-training.play.ts
import Alpine from "alpinejs";
import {
  isScoreTrainingSession,
  type ScoreTrainingSession,
} from "@lib/shared/games/score-training/session";
import { buildRoundRecord } from "@lib/shared/games/score-training/round";
import {
  applyRoundToState,
  revertRoundFromState,
} from "@lib/shared/games/score-training/state";
import {
  buildSummary,
  type ScoreTrainingSummary,
} from "@lib/shared/games/score-training/summary";
import type {
  ApiResponse,
  ScoreTrainingCompleteSuccess,
} from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { t } from "@lib/shared/i18n";
import type { ConfirmationModalStore } from "@lib/client/alpine/stores/confirmationModal.store";

export const SCORE_TRAINING_SESSION_KEY = "score-training-session";

/** Clears the Alpine persist entry for an in-progress game. */
export function clearPersistedScoreTrainingSession(): void {
  sessionStorage.removeItem(Alpine.prefixed(SCORE_TRAINING_SESSION_KEY));
}

export function scoreTrainingPlay(serverSession: ScoreTrainingSession | null) {
  let timerId: ReturnType<typeof setInterval> | null = null;

  return {
    ready: false,
    session: Alpine.$persist(serverSession)
      .as(SCORE_TRAINING_SESSION_KEY)
      .using(sessionStorage),
    score: null as string | null,
    loading: false,
    error: "",
    showSummary: false,
    summary: null as ScoreTrainingSummary | null,
    timerExpired: false,

    get controlsDisabled() {
      return (
        !this.ready ||
        this.loading ||
        this.session.state.status === "paused" ||
        this.showSummary
      );
    },

    init() {
      if (serverSession) {
        this.session = serverSession;
      }

      if (
        !isScoreTrainingSession(this.session) ||
        this.session.state.status === "completed"
      ) {
        window.location.href = "/games/settings-score-training";
        return;
      }

      this.ready = true;

      if (this.session.settings.endMode === "timed") {
        this.startTimer();
      }
    },

    async submitScore() {
      if (!this.ready || this.score === null) return;
      const parsed = Number(this.score);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 180) return;

      const round = buildRoundRecord(
        this.session.state.currentRound,
        parsed,
        this.session.state.currentScore,
      );
      this.session.state = applyRoundToState(
        this.session.state,
        round,
        this.session.settings,
      );
      this.session.roundHistory.push(round);
      this.score = null;

      if (this.session.state.status === "completed") {
        this.showSummary = true;
        await this.persistCompletion();
      }
    },

    async undo() {
      if (!this.ready || this.session.roundHistory.length === 0) return;
      const lastRound = this.session.roundHistory.pop()!;
      this.session.state = revertRoundFromState(
        this.session.state,
        lastRound,
        this.session.settings,
      );
    },

    async completeOnTimerExpiry() {
      if (this.session.settings.endMode !== "timed") return;
      this.session.state.status = "completed";
      this.showSummary = true;
      await this.persistCompletion();
    },

    async persistCompletion() {
      this.loading = true;
      this.error = "";
      this.showSummary = true;
      try {
        const response = await fetch("/api/games/score-training/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: this.session }),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }
        this.summary =
          (data as ScoreTrainingCompleteSuccess).summary ??
          buildSummary(this.session);
        clearPersistedScoreTrainingSession();
        this.stopTimer();
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    confirmLeave() {
      clearPersistedScoreTrainingSession();
      window.location.href = "/games";
    },

    // Retain unchanged from current score-training.play.ts:
    // leave(), togglePause(), startTimer(), stopTimer(),
    // timerShouldTick, threeDartAverageDisplay, dartsThrownDisplay,
    // lastScoreDisplay, timerDisplay, summaryAverageDisplay
  };
}
```

No `loading = true` on `submitScore` or `undo`. `$persist` handles session writes.

- [ ] **Step 4: Wire skeleton swap in Play.astro**

```astro
---
// app/src/components/games/score-training/Play.astro
import NumberInputPad from "@components/ui/NumberInputPad.astro";
import ScoreCard from "./ScoreCard.astro";
import ProgressBar from "./ProgressBar.astro";
import Summary from "./Summary.astro";
import PlayShellSkeleton from "./PlayShellSkeleton.astro";
import SummarySkeleton from "./SummarySkeleton.astro";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";
import LeaveIcon from "@icons/leave.svg";

interface Props {
  displayName: string;
  gameSession?: ScoreTrainingSession | null;
}

const { displayName, gameSession = null } = Astro.props;
const sessionJson = gameSession
  ? JSON.stringify(gameSession).replace(/</g, "\\u003c")
  : "null";
---

<section
  class="relative flex-1 h-full flex flex-col gap-4"
  x-data={`scoreTrainingPlay(${sessionJson})`}
  x-init="init()"
  :aria-busy="!ready || (showSummary && !summary)"
>
  <div class="flex justify-between py-2">
    <button type="button" class="btn-press" @click="leave()">
      <LeaveIcon class="size-6 text-text-muted rotate-180" />
    </button>
    <h2 class="text-xl font-semibold">{displayName}</h2>
    <div class="size-6 transparent"></div>
  </div>

  <div x-show="!ready">
    <PlayShellSkeleton />
  </div>

  <div x-show="ready && !showSummary" x-cloak class="flex flex-col gap-4 flex-1">
    <ProgressBar />
    <ScoreCard />
    <article class="game-panel flex-1 p-4 flex flex-col">
      <NumberInputPad
        scoreModel="score"
        submitAction="submitScore()"
        disabledExpr="controlsDisabled"
        canUndoExpr="session.roundHistory.length > 0"
        undoAction="undo()"
      />
    </article>
  </div>

  <div x-show="showSummary && !summary" x-cloak>
    <SummarySkeleton />
  </div>
  <Summary showSummaryModel="showSummary && summary" />

  <p x-show="error" x-cloak x-text="error" class="text-sm text-red-400" role="alert"></p>
</section>
```

- [ ] **Step 5: Update assembly test for skeleton wiring**

Add to `app/tests/pages/score-training-play-assembly.test.ts`:

```typescript
it("renders skeleton shells and swaps on ready / summary", () => {
  const source = readSource("src/components/games/score-training/Play.astro");

  expect(source).toContain('import PlayShellSkeleton from "./PlayShellSkeleton.astro"');
  expect(source).toContain('import SummarySkeleton from "./SummarySkeleton.astro"');
  expect(source).toContain('x-show="!ready"');
  expect(source).toContain('x-show="ready && !showSummary"');
  expect(source).toContain('x-show="showSummary && !summary"');
  expect(source).toContain('showSummaryModel="showSummary && summary"');
  expect(source).toContain(":aria-busy");
  expect(source).toContain("<PlayShellSkeleton />");
  expect(source).toContain("<SummarySkeleton />");
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd app && npm test -- tests/lib/client/alpine/games/score-training.play.test.ts tests/pages/score-training-play-assembly.test.ts`
Expected: PASS

- [ ] **Step 7: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 9: Settings Shell — Native Form POST

**Files:**

- Modify: `app/src/components/games/score-training/ScoreTrainingSettingsShell.astro`
- Modify: `app/src/lib/client/alpine/games/score-training.settings.ts`
- Modify: `app/src/pages/games/settings-[game].astro`
- Test: `app/tests/lib/client/alpine/games/score-training.settings.test.ts`

- [ ] **Step 1: Update settings Alpine test**

```typescript
import { scoreTrainingSettings } from "@lib/client/alpine/games/score-training.settings";

describe("scoreTrainingSettings", () => {
  it("exposes endMode for radio x-model binding", () => {
    const component = scoreTrainingSettings();
    expect(component.endMode).toBe("rounds");
  });
});
```

- [ ] **Step 2: Simplify settings Alpine factory**

```typescript
// app/src/lib/client/alpine/games/score-training.settings.ts
export function scoreTrainingSettings() {
  return {
    endMode: "rounds" as "rounds" | "timed",
  };
}
```

- [ ] **Step 3: Update ScoreTrainingSettingsShell.astro**

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
  class="mx-auto w-full max-w-2xl p-4 @sm:p-6"
  x-data="scoreTrainingSettings()"
>
  <form id="game-settings-form" method="POST" action={playUrl} class="space-y-4">
    <slot />
    <PrimaryBtn type="submit" label="Play" />
  </form>
</main>
```

Remove resume/abandon banner entirely.

- [ ] **Step 4: Remove score-training session lookup from settings page**

In `app/src/pages/games/settings-[game].astro`:

- Remove imports: `getScoreTrainingSession`, `isScoreTrainingSession`
- Remove `else if (slug === "score-training" ...)` block
- Change shell usage: `<ScoreTrainingSettingsShell game={game}>` (no `hasActiveSession`)

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 10: Play Page POST Handler + GET Refresh Shell

**Files:**

- Modify: `app/src/pages/games/[game].astro`
- Test: `app/tests/pages/score-training-play-assembly.test.ts`

- [ ] **Step 1: Update assembly test expectations**

```typescript
it("starts score-training via POST form validation", () => {
  const source = readSource("src/pages/games/[game].astro");

  expect(source).toContain("parseScoreTrainingSettingsFormData");
  expect(source).toContain("buildScoreTrainingSession");
  expect(source).toContain('Astro.request.method === "POST"');
  expect(source).toContain('slug === "score-training"');
  expect(source).not.toContain("getScoreTrainingSession");
});

it("does not server-redirect score-training GET ($persist restores client-side)", () => {
  const source = readSource("src/pages/games/[game].astro");
  expect(source).not.toMatch(
    /slug === "score-training"[\s\S]*return Astro\.redirect\(`\/games\/settings-\$\{slug\}`\)/,
  );
});

it("Play.astro accepts optional gameSession, skeleton shells, and $persist in play factory", () => {
  const playSource = readSource("src/components/games/score-training/Play.astro");
  const factorySource = readSource("src/lib/client/alpine/games/score-training.play.ts");
  expect(playSource).toContain("gameSession?:");
  expect(playSource).toContain("PlayShellSkeleton");
  expect(playSource).toContain("SummarySkeleton");
  expect(playSource).toContain('x-show="!ready"');
  expect(factorySource).toContain("$persist");
  expect(factorySource).toContain("ready: false");
  expect(factorySource).toContain(".using(sessionStorage)");
});
```

- [ ] **Step 2: Refactor play page frontmatter**

```typescript
let scoreTrainingSession: ScoreTrainingSession | null = null;

if (slug === "score-training") {
  if (Astro.request.method === "POST") {
    const formData = await Astro.request.formData();
    const parsed = parseScoreTrainingSettingsFormData(formData);
    const validated = validateScoreTrainingSettings(parsed);
    if (!validated.valid) {
      return Astro.redirect(`/games/settings-${slug}?error=invalid-settings`);
    }
    scoreTrainingSession = buildScoreTrainingSession(validated.value);
  }
  // GET: render play shell with gameSession=null; $persist hydrates from sessionStorage
}

// Skip incrementPlayCount for score-training (moved to completion API):
if (session.userId && slug !== "score-training") {
  try {
    await incrementPlayCount(session.userId, slug);
  } catch {
    // Non-fatal
  }
}

// Render for score-training on both POST and GET:
// <Play displayName={game.displayName} gameSession={scoreTrainingSession} />
```

- [ ] **Step 3: Run verification gate**

Run: `cd app && npm run check && npm test`

---

### Task 11: Remove Obsolete Routes and Data Layer

**Files:**

- Delete: session API routes, `score-training-session.ts`, related tests
- Modify: any remaining imports referencing deleted modules

- [ ] **Step 1: Delete files**

```
app/src/pages/api/games/score-training/session.ts
app/src/pages/api/games/score-training/session/round.ts
app/src/pages/api/games/score-training/session/round/last.ts
app/src/pages/api/games/score-training/session/complete.ts
app/src/lib/server/data/score-training-session.ts
app/tests/lib/server/data/score-training-session.test.ts
app/tests/api/games/score-training/session.test.ts
app/tests/api/games/score-training/round.test.ts
app/tests/api/games/score-training/round-last.test.ts
```

- [ ] **Step 2: Grep for stale references**

Run: `cd app && rg "score-training-session|/session/round|scoreTrainingSettings\\(" src tests`

Fix any remaining imports. `scoreTrainingSettings` call in `app.factory.ts` should become `scoreTrainingSettings` with no args.

- [ ] **Step 3: Run full verification gate**

Run:

```bash
cd app
npm run check
npm test
npm run build
npx fallow
```

Expected: all exit 0.

**Fallow:** Clean up genuine unused exports/types/deps fallow reports. Double-verify each finding — do **not** delete `src/lib/client/alpine/app.factory.ts` (Alpine entrypoint in `astro.config.mjs`, listed in `.fallowrc.json` `dynamicallyLoaded`). Re-run the full gate after cleanup.

---

## Spec Coverage Checklist

| Spec requirement                            | Task          |
| ------------------------------------------- | ------------- |
| Form POST settings handoff                  | Task 9, 10    |
| Alpine `$persist` with sessionStorage       | Task 3, 8     |
| Refresh restores via `$persist`             | Task 8, 10    |
| Leave clears persist storage (progress lost)| Task 8        |
| Client-only round/undo/timer                | Task 8        |
| Single completion API                       | Task 6, 7     |
| Stats + play count on completion only       | Task 7, 10    |
| Remove active session DB storage            | Task 11       |
| Remove resume/abandon UI                    | Task 9        |
| Server-side completion validation           | Task 6, 7     |
| Error handling (invalid settings redirect)  | Task 10       |
| Skeleton primitive + reduced-motion CSS     | Task 4        |
| Per-region skeleton components              | Task 5        |
| `ready` gate swaps skeleton → live UI       | Task 8        |
| Summary skeleton during completion API      | Task 8        |
| `aria-busy` during hydrate/complete         | Task 8        |
| Play assembly includes static skeleton HTML | Task 8, 10    |

## Execution Options

**Plan saved to:** `docs/superpowers/plans/2026-06-19-score-training-client-session.md`

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
