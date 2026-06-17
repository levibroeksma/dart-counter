# Game Codes Registry & TUOD Minutes Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
> 1. **test-driven-development** — for any task that writes or changes code
> 2. **verification-before-completion** — run the per-task verification gate before marking the task done; no completion claims without fresh command output
> 3. **NEVER commit** — do not run `git add`, `git commit`, or `git push` at any point. The controller commits after review.

**Goal:** Add a metadata-only game codes registry with `tuod` for ten-up-one-down, and change TUOD timed settings to minutes in the UI (score-training pattern).

**Architecture:** New `codes.ts` module with `GAME_CODES` map and lookup/format helpers. TUOD settings form and Alpine factory mirror score-training: minutes in UI, `playtimeSeconds` in API payload and validation.

**Tech Stack:** Astro 6, Alpine.js 3, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-06-17-game-codes-tuod-minutes-design.md`  
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

Run only after Task 2 is complete. REQUIRED SUB-SKILL: verification-before-completion.

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
| `src/lib/shared/games/codes.ts` | `GAME_CODES` map, `getGameCode`, `formatGameCode` |
| `tests/lib/shared/games/codes.test.ts` | Registry lookup and display formatting |
| `src/components/games/ten-up-one-down/SettingsForm.astro` | Minutes input for timed mode |
| `src/lib/client/alpine/games/ten-up-one-down.settings.ts` | `playtimeMinutes` → `playtimeSeconds` conversion |
| `tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts` | Minutes conversion test |

---

### Task 1: Game codes registry

**Files:**
- Create: `app/src/lib/shared/games/codes.ts`
- Create: `app/tests/lib/shared/games/codes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/shared/games/codes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getGameCode, formatGameCode } from "@lib/shared/games/codes";

describe("game codes", () => {
  it("returns tuod for ten-up-one-down", () => {
    expect(getGameCode("ten-up-one-down")).toBe("tuod");
  });

  it("returns undefined for slugs without a code", () => {
    expect(getGameCode("score-training")).toBeUndefined();
  });

  it("formats code for display", () => {
    expect(formatGameCode("tuod")).toBe("TUOD");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/codes.test.ts`

Expected: FAIL — module `@lib/shared/games/codes` not found

- [ ] **Step 3: Write minimal implementation**

Create `app/src/lib/shared/games/codes.ts`:

```typescript
export const GAME_CODES: Partial<Record<string, string>> = {
  "ten-up-one-down": "tuod",
};

/**
 * Returns the lowercase game code for a slug, if registered.
 */
export function getGameCode(slug: string): string | undefined {
  return GAME_CODES[slug];
}

/**
 * Formats a stored game code for display (uppercase).
 */
export function formatGameCode(code: string): string {
  return code.toUpperCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/codes.test.ts`

Expected: PASS (3 tests)

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test`

Expected: check 0/0/0; full test suite 0 failures

---

### Task 2: TUOD timed settings in minutes

**Files:**
- Modify: `app/src/components/games/ten-up-one-down/SettingsForm.astro`
- Modify: `app/src/lib/client/alpine/games/ten-up-one-down.settings.ts`
- Modify: `app/tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts`

- [ ] **Step 1: Write the failing Alpine settings test**

Add to `app/tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts` (keep existing tests):

```typescript
  it("converts playtime minutes to seconds", () => {
    const component = tenUpOneDownSettings("/games/ten-up-one-down", false);

    const form = document.createElement("form");
    form.innerHTML = `
      <input name="endMode" value="timed" />
      <input name="playtimeMinutes" value="10" />
    `;

    const settings = component.formDataToSettings(form);

    expect(settings).toEqual({
      endMode: "timed",
      playtimeSeconds: 600,
    });
    expect(settings).not.toHaveProperty("playtimeMinutes");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts`

Expected: FAIL — `playtimeSeconds` not 600 or `playtimeMinutes` present in result

- [ ] **Step 3: Update Alpine settings factory**

In `app/src/lib/client/alpine/games/ten-up-one-down.settings.ts`, replace `formDataToSettings` with:

```typescript
    formDataToSettings(form: HTMLFormElement): Record<string, unknown> {
      const settings: Record<string, unknown> = {};

      for (const [key, value] of new FormData(form).entries()) {
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
    },
```

- [ ] **Step 4: Run Alpine test to verify it passes**

Run: `cd app && npm test -- tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts`

Expected: PASS (2 tests)

- [ ] **Step 5: Update SettingsForm.astro**

Replace the frontmatter imports and timed-mode field in `app/src/components/games/ten-up-one-down/SettingsForm.astro`.

Frontmatter:

```astro
---
import {
  DEFAULT_ROUND_COUNT,
  MAX_ROUND_COUNT,
  MIN_ROUND_COUNT,
} from "@lib/shared/games/ten-up-one-down/constants";

const DEFAULT_PLAYTIME_MINUTES = 10;
const MIN_PLAYTIME_MINUTES = 5;
const MAX_PLAYTIME_MINUTES = 30;
---
```

Timed field (replace the seconds label/input block):

```astro
<label class="block space-y-1" x-show="endMode === 'timed'" x-cloak>
  <span class="text-text-muted text-sm">Play time (minutes)</span>
  <input
    type="number"
    name="playtimeMinutes"
    value={DEFAULT_PLAYTIME_MINUTES}
    min={MIN_PLAYTIME_MINUTES}
    max={MAX_PLAYTIME_MINUTES}
    class="input-field"
  />
</label>
```

Remove unused imports: `DEFAULT_PLAYTIME_SECONDS`, `MAX_PLAYTIME_SECONDS`, `MIN_PLAYTIME_SECONDS`.

- [ ] **Step 6: Run verification gate**

Run: `cd app && npm run check && npm test`

Expected: check 0/0/0; full test suite 0 failures

---

## Spec Coverage Checklist

| Spec requirement | Task |
| ---------------- | ---- |
| `GAME_CODES` with `tuod` | Task 1 |
| `getGameCode` / `formatGameCode` | Task 1 |
| Codes tests | Task 1 |
| TUOD form minutes UI | Task 2 |
| Alpine minutes → seconds | Task 2 |
| Alpine settings test | Task 2 |
| No slug/URL/blob changes | N/A (no tasks touch these) |
| Validation unchanged | N/A (no tasks touch validation) |
