# Singles Training Client Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate singles-training active session DB usage; hold in-game state in Alpine `$persist`; validate settings via form POST; apply darts/undo locally; persist stats and play count only on completion; show summary skeleton during completion API; client-side play again.

**Architecture:** Shared helpers parse form data, build initial session, and validate terminal sessions. Play page handles POST for singles-training start. In-progress state held in Alpine `$persist(...).using(sessionStorage)`. Alpine play controller applies darts locally with a `ready` gate and skeleton placeholders. Single `/api/games/singles-training/complete` endpoint writes stats + play count. Settings use native form POST (no resume/abandon banner).

**Tech Stack:** Astro 6, Alpine.js 3, `@alpinejs/persist` (already registered), TypeScript, Vitest, Drizzle/Neon Postgres

**Spec:** `docs/superpowers/specs/2026-06-22-singles-training-client-session-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

---

## Verification Gate (every task)

```bash
cd app && npm run check && npm test && npx fallow
```

Required:

- `npm run check` → 0 errors / 0 warnings / 0 hints
- `npm test` → exit 0, 0 failures
- `npx fallow` → exit 0 (verify findings before removing; see Final Verification Gate)

---

## File Structure Overview

| File | Responsibility |
| ---- | -------------- |
| `src/lib/shared/games/singles-training/form-data.ts` | Parse settings FormData → validation input |
| `src/lib/shared/games/singles-training/session-factory.ts` | Build in-memory session from validated settings |
| `src/lib/shared/games/singles-training/completion.ts` | Validate terminal session payload for API |
| `src/pages/api/games/singles-training/complete.ts` | Sole DB write endpoint (stats + play count) |
| `src/pages/games/[game].astro` | POST handler for singles-training; remove DB session load |
| `src/pages/games/settings-[game].astro` | Remove singles-training active session lookup |
| `src/components/games/singles-training/SinglesTrainingSettingsShell.astro` | Native form POST; remove resume/abandon |
| `src/lib/client/alpine/games/singles-training.settings.ts` | Remove fetch/resume/abandon (empty factory or delete if unused) |
| `src/lib/client/alpine/games/singles-training.play.ts` | `$persist` session; client darts/undo; completion API; play again |
| `src/components/games/singles-training/PlayShellSkeleton.astro` | Play chrome placeholder until `ready` |
| `src/components/games/singles-training/SummarySkeleton.astro` | Summary placeholder during completion API |
| `src/components/games/singles-training/Play.astro` | Skeleton/live swap via `ready` and `showSummary && !summary` |
| `src/lib/shared/api/types.ts` | Add `SinglesTrainingCompleteSuccess` |

**Delete:**

| File | Reason |
| ---- | ------ |
| `src/pages/api/games/singles-training/session.ts` | No active session CRUD |
| `src/pages/api/games/singles-training/session/dart.ts` | Darts are client-side |
| `src/pages/api/games/singles-training/session/dart/last.ts` | Undo is client-side |
| `src/pages/api/games/singles-training/session/play-again.ts` | Play again is client-side |
| `src/lib/server/data/singles-training-session.ts` | No active session storage |
| `tests/lib/server/data/singles-training-session.test.ts` | Data layer removed |
| `tests/api/games/singles-training/session.test.ts` | Route removed |
| `tests/api/games/singles-training/dart.test.ts` | Route removed |
| `tests/api/games/singles-training/dart-last.test.ts` | Route removed |
| `tests/api/games/singles-training/play-again.test.ts` | Route removed |

---

## Data Flow

```
Game ends (dead or completed)
  → showSummary = true, summary = null (skeleton)
  → persistCompletion() POST /api/games/singles-training/complete
      → save stats + increment play count
      → summary populated, persist cleared
  → Summary panel visible (showSummary && summary)

User clicks "Yes" (playAgain)
  → guard: session && summary must exist
  → session = buildSinglesTrainingSession(session.settings)
  → showSummary = false, summary = null
  → $persist auto-syncs new active session
```

---

### Task 1: Shared Form Data Parser

**Files:**
- Create: `app/src/lib/shared/games/singles-training/form-data.ts`
- Test: `app/tests/lib/shared/games/singles-training/form-data.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/singles-training/form-data.test.ts
import { describe, it, expect } from "vitest";
import { parseSinglesTrainingSettingsFormData } from "@lib/shared/games/singles-training/form-data";

describe("parseSinglesTrainingSettingsFormData", () => {
  it("maps direction, mode, and scoring from form fields", () => {
    const formData = new FormData();
    formData.set("direction", "high-to-low");
    formData.set("mode", "hard");
    formData.set("scoring", "uniform");

    expect(parseSinglesTrainingSettingsFormData(formData)).toEqual({
      direction: "high-to-low",
      mode: "hard",
      scoring: "uniform",
    });
  });

  it("returns empty object for empty form", () => {
    expect(parseSinglesTrainingSettingsFormData(new FormData())).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/form-data.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/singles-training/form-data.ts

/**
 * Converts singles-training settings form fields to validation input.
 */
export function parseSinglesTrainingSettingsFormData(
  formData: FormData,
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    settings[key] = value;
  }

  return settings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/form-data.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 2: Session Factory

**Files:**
- Create: `app/src/lib/shared/games/singles-training/session-factory.ts`
- Test: `app/tests/lib/shared/games/singles-training/session-factory.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/singles-training/session-factory.test.ts
import { describe, it, expect } from "vitest";
import { buildSinglesTrainingSession } from "@lib/shared/games/singles-training/session-factory";
import { ALL_TARGETS } from "@lib/shared/games/singles-training/target-sequence";
import { TARGET_COUNT } from "@lib/shared/games/singles-training/constants";

describe("buildSinglesTrainingSession", () => {
  it("creates an active session with low-to-high target sequence", () => {
    const session = buildSinglesTrainingSession({
      direction: "low-to-high",
      mode: "normal",
      scoring: "traditional",
    });

    expect(session.slug).toBe("singles-training");
    expect(session.targetSequence).toEqual(ALL_TARGETS);
    expect(session.targetSequence).toHaveLength(TARGET_COUNT);
    expect(session.state.status).toBe("active");
    expect(session.state.currentTargetIndex).toBe(0);
    expect(session.dartHistory).toEqual([]);
    expect(session.createdAt).toMatch(/^\d{4}-/);
    expect(session.updatedAt).toMatch(/^\d{4}-/);
  });

  it("shuffles target sequence for random direction", () => {
    const session = buildSinglesTrainingSession(
      { direction: "random", mode: "normal", scoring: "traditional" },
      () => 0.5,
    );
    expect(session.targetSequence).toHaveLength(TARGET_COUNT);
    expect([...session.targetSequence].sort()).toEqual(
      [...ALL_TARGETS].sort((a, b) =>
        a === "bull" ? 1 : b === "bull" ? -1 : Number(a) - Number(b),
      ),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/session-factory.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/singles-training/session-factory.ts
import { createInitialGameState } from "@lib/shared/games/singles-training/state";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";
import type { SinglesTrainingSettings } from "@lib/shared/games/singles-training/settings";
import { buildTargetSequence } from "@lib/shared/games/singles-training/target-sequence";

/**
 * Builds an in-memory singles-training session from validated settings.
 */
export function buildSinglesTrainingSession(
  settings: SinglesTrainingSettings,
  random: () => number = Math.random,
): SinglesTrainingSession {
  const now = new Date().toISOString();

  return {
    slug: "singles-training",
    settings,
    targetSequence: buildTargetSequence(settings.direction, random),
    state: createInitialGameState(),
    dartHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/session-factory.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 3: Completion Validator

**Files:**
- Create: `app/src/lib/shared/games/singles-training/completion.ts`
- Test: `app/tests/lib/shared/games/singles-training/completion.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/shared/games/singles-training/completion.test.ts
import { describe, it, expect } from "vitest";
import { validateCompletedSinglesTrainingSession } from "@lib/shared/games/singles-training/completion";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildSinglesTrainingSession } from "@lib/shared/games/singles-training/session-factory";
import { applyDartToSession } from "@lib/shared/games/singles-training/state";
import { ALL_TARGETS } from "@lib/shared/games/singles-training/target-sequence";

function buildDeadSession() {
  let session = buildSinglesTrainingSession({
    direction: "low-to-high",
    mode: "hard",
    scoring: "traditional",
  });
  session = applyDartToSession(session, { type: "miss" });
  session = applyDartToSession(session, { type: "miss" });
  session = applyDartToSession(session, { type: "miss" });
  return session;
}

describe("validateCompletedSinglesTrainingSession", () => {
  it("accepts a legitimately dead session", () => {
    const session = buildDeadSession();
    const result = validateCompletedSinglesTrainingSession(session);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.state.status).toBe("dead");
  });

  it("rejects active session", () => {
    const session = buildSinglesTrainingSession({
      direction: "low-to-high",
      mode: "normal",
      scoring: "traditional",
    });
    const result = validateCompletedSinglesTrainingSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.GAME_NOT_COMPLETE });
  });

  it("rejects tampered score", () => {
    const session = buildDeadSession();
    session.state.score = 999;
    const result = validateCompletedSinglesTrainingSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_DART_OUTCOME });
  });

  it("rejects invalid target sequence for low-to-high", () => {
    const session = buildDeadSession();
    session.targetSequence = [2, 1, ...ALL_TARGETS.slice(2)];
    const result = validateCompletedSinglesTrainingSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });

  it("rejects invalid shape", () => {
    const result = validateCompletedSinglesTrainingSession({ slug: "501" });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/completion.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/shared/games/singles-training/completion.ts
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  isSinglesTrainingSession,
  type SinglesTrainingSession,
} from "@lib/shared/games/singles-training/session";
import { applyDartToSession } from "@lib/shared/games/singles-training/state";
import { validateSinglesTrainingSettings } from "@lib/shared/games/singles-training/validation";
import {
  ALL_TARGETS,
  buildTargetSequence,
} from "@lib/shared/games/singles-training/target-sequence";
import { createInitialGameState } from "@lib/shared/games/singles-training/state";

export type ValidateCompletedSinglesResult =
  | { valid: true; value: SinglesTrainingSession }
  | {
      valid: false;
      code:
        | typeof MessageCode.INVALID_GAME_SETTINGS
        | typeof MessageCode.GAME_NOT_COMPLETE
        | typeof MessageCode.INVALID_DART_OUTCOME;
    };

function isValidRandomSequence(sequence: SinglesTrainingSession["targetSequence"]): boolean {
  if (sequence.length !== ALL_TARGETS.length) return false;
  const normalized = sequence.map((t) => String(t)).sort();
  const expected = ALL_TARGETS.map((t) => String(t)).sort();
  return normalized.every((t, i) => t === expected[i]);
}

function isValidTargetSequence(session: SinglesTrainingSession): boolean {
  const { direction } = session.settings;
  if (direction === "random") return isValidRandomSequence(session.targetSequence);
  const expected = buildTargetSequence(direction);
  if (session.targetSequence.length !== expected.length) return false;
  return session.targetSequence.every((t, i) => t === expected[i]);
}

function replaySession(session: SinglesTrainingSession): SinglesTrainingSession {
  let replayed: SinglesTrainingSession = {
    ...session,
    state: createInitialGameState(),
    dartHistory: [],
  };
  for (const dart of session.dartHistory) {
    replayed = applyDartToSession(replayed, dart.outcome);
  }
  return replayed;
}

function statesMatch(
  a: SinglesTrainingSession["state"],
  b: SinglesTrainingSession["state"],
): boolean {
  return (
    a.status === b.status &&
    a.currentTargetIndex === b.currentTargetIndex &&
    a.currentDartInVisit === b.currentDartInVisit &&
    a.score === b.score &&
    a.segmentCounts.miss === b.segmentCounts.miss &&
    a.segmentCounts.single === b.segmentCounts.single &&
    a.segmentCounts.double === b.segmentCounts.double &&
    a.segmentCounts.triple === b.segmentCounts.triple
  );
}

/**
 * Validates a client-submitted terminal singles-training session.
 */
export function validateCompletedSinglesTrainingSession(
  raw: unknown,
): ValidateCompletedSinglesResult {
  if (!isSinglesTrainingSession(raw)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const session = raw;
  const settingsCheck = validateSinglesTrainingSettings(
    session.settings as unknown as Record<string, unknown>,
  );
  if (!settingsCheck.valid) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  if (session.state.status !== "dead" && session.state.status !== "completed") {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  if (session.dartHistory.length === 0) {
    return { valid: false, code: MessageCode.GAME_NOT_COMPLETE };
  }

  if (!isValidTargetSequence(session)) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const replayed = replaySession(session);
  if (!statesMatch(replayed.state, session.state)) {
    return { valid: false, code: MessageCode.INVALID_DART_OUTCOME };
  }

  if (replayed.dartHistory.length !== session.dartHistory.length) {
    return { valid: false, code: MessageCode.INVALID_DART_OUTCOME };
  }

  return { valid: true, value: session };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/shared/games/singles-training/completion.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 4: Completion API + API Types

**Files:**
- Create: `app/src/pages/api/games/singles-training/complete.ts`
- Modify: `app/src/lib/shared/api/types.ts`
- Test: `app/tests/api/games/singles-training/complete.test.ts`

- [ ] **Step 1: Add API type**

In `app/src/lib/shared/api/types.ts`, add after `ScoreTrainingCompleteSuccess`:

```typescript
export type SinglesTrainingCompleteSuccess = {
  ok: true;
  summary: SinglesTrainingSummary;
};
```

Add `SinglesTrainingCompleteSuccess` to the `ApiSuccess` union.

- [ ] **Step 2: Write the failing test**

```typescript
// app/tests/api/games/singles-training/complete.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "@api/games/singles-training/complete";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptySinglesTrainingStats } from "@lib/shared/games/singles-training/stats";
import { buildSinglesTrainingSession } from "@lib/shared/games/singles-training/session-factory";
import { applyDartToSession } from "@lib/shared/games/singles-training/state";

const mockGetSession = vi.fn();
const mockGetPlayerSinglesTrainingStats = vi.fn();
const mockSavePlayerSinglesTrainingStats = vi.fn();
const mockIncrementPlayCount = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/player-singles-training-stats", () => ({
  getPlayerSinglesTrainingStats: (...args: unknown[]) =>
    mockGetPlayerSinglesTrainingStats(...args),
  savePlayerSinglesTrainingStats: (...args: unknown[]) =>
    mockSavePlayerSinglesTrainingStats(...args),
}));

vi.mock("@lib/server/data/games", () => ({
  incrementPlayCount: (...args: unknown[]) => mockIncrementPlayCount(...args),
}));

function buildDeadSession() {
  let session = buildSinglesTrainingSession({
    direction: "low-to-high",
    mode: "hard",
    scoring: "traditional",
  });
  session = applyDartToSession(session, { type: "miss" });
  session = applyDartToSession(session, { type: "miss" });
  session = applyDartToSession(session, { type: "miss" });
  return session;
}

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/singles-training/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/singles-training/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      userId: "00000000-0000-4000-8000-000000000001",
    });
    mockGetPlayerSinglesTrainingStats.mockResolvedValue(
      createEmptySinglesTrainingStats(),
    );
    mockSavePlayerSinglesTrainingStats.mockResolvedValue(undefined);
    mockIncrementPlayCount.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });
    const response = await POST(createContext({ session: buildDeadSession() }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 400 for active session", async () => {
    const response = await POST(
      createContext({
        session: buildSinglesTrainingSession({
          direction: "low-to-high",
          mode: "normal",
          scoring: "traditional",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.GAME_NOT_COMPLETE,
    });
  });

  it("saves stats, increments play count, and returns summary", async () => {
    const session = buildDeadSession();
    const response = await POST(createContext({ session }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.summary.status).toBe("dead");
    expect(data.summary.dartsThrown).toBe(3);
    expect(mockSavePlayerSinglesTrainingStats).toHaveBeenCalledTimes(1);
    expect(mockIncrementPlayCount).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "singles-training",
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npm test -- tests/api/games/singles-training/complete.test.ts`  
Expected: FAIL

- [ ] **Step 4: Implement completion API**

```typescript
// app/src/pages/api/games/singles-training/complete.ts
import type { APIRoute } from "astro";
import type { ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { validateCompletedSinglesTrainingSession } from "@lib/shared/games/singles-training/completion";
import { buildSummary } from "@lib/shared/games/singles-training/summary";
import { applyGameCompletionToStats } from "@lib/shared/games/singles-training/stats";
import { getSession } from "@lib/server/auth/session";
import { incrementPlayCount } from "@lib/server/data/games";
import {
  getPlayerSinglesTrainingStats,
  savePlayerSinglesTrainingStats,
} from "@lib/server/data/player-singles-training-stats";

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

  const validated = validateCompletedSinglesTrainingSession(sessionPayload);
  if (!validated.valid) {
    return jsonResponse({ ok: false, code: validated.code }, 400);
  }

  try {
    const summary = buildSummary(validated.value);
    const stats = await getPlayerSinglesTrainingStats(auth.userId);
    applyGameCompletionToStats(stats, validated.value);
    await savePlayerSinglesTrainingStats(auth.userId, stats);
    await incrementPlayCount(auth.userId, "singles-training");
    return jsonResponse({ ok: true, summary }, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npm test -- tests/api/games/singles-training/complete.test.ts`  
Expected: PASS

- [ ] **Step 6: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 5: Play Page POST Handler

**Files:**
- Modify: `app/src/pages/games/[game].astro`

- [ ] **Step 1: Write the failing assembly test**

Add to `app/tests/pages/singles-training-play-assembly.test.ts`:

```typescript
  it("starts singles-training via POST form validation", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).toContain("parseSinglesTrainingSettingsFormData");
    expect(source).toContain("buildSinglesTrainingSession");
    expect(source).toContain('slug === "singles-training"');
    expect(source).not.toContain("getSinglesTrainingSession");
  });

  it("does not server-redirect singles-training GET ($persist restores client-side)", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).not.toMatch(
      /slug === "singles-training"[\s\S]*return Astro\.redirect\(`\/games\/settings-\$\{slug\}`\)/,
    );
  });
```

Remove or replace the test `"routes singles-training play through persisted session"` that expects `getSinglesTrainingSession`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/pages/singles-training-play-assembly.test.ts`  
Expected: FAIL on new assertions

- [ ] **Step 3: Update `[game].astro`**

Add imports:

```typescript
import { parseSinglesTrainingSettingsFormData } from "@lib/shared/games/singles-training/form-data";
import { buildSinglesTrainingSession } from "@lib/shared/games/singles-training/session-factory";
import { validateSinglesTrainingSettings } from "@lib/shared/games/singles-training/validation";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";
```

Remove `getSinglesTrainingSession` import and `singlesTrainingSession` load/redirect block.

Change `incrementPlayCount` guard to exclude singles-training (alongside score-training):

```typescript
if (session.userId && slug !== "score-training" && slug !== "singles-training") {
```

Add singles-training POST handler (parallel to score-training):

```typescript
let singlesTrainingSession: SinglesTrainingSession | null = null;

if (slug === "singles-training") {
  if (Astro.request.method === "POST") {
    const formData = await Astro.request.formData();
    const parsed = parseSinglesTrainingSettingsFormData(formData);
    const validated = validateSinglesTrainingSettings(parsed);
    if (!validated.valid) {
      return Astro.redirect(`/games/settings-${slug}?error=invalid-settings`);
    }
    singlesTrainingSession = buildSinglesTrainingSession(validated.value);
  }
}
```

Update Play render branch:

```astro
) : slug === "singles-training" ? (
  <Play displayName={game.displayName} gameSession={singlesTrainingSession} />
```

- [ ] **Step 4: Run assembly test to verify it passes**

Run: `cd app && npm test -- tests/pages/singles-training-play-assembly.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 6: Settings Shell — Form POST, Remove Resume/Abandon

**Files:**
- Modify: `app/src/components/games/singles-training/SinglesTrainingSettingsShell.astro`
- Modify: `app/src/pages/games/settings-[game].astro`
- Modify: `app/src/lib/client/alpine/games/singles-training.settings.ts`
- Test: `app/tests/lib/client/alpine/games/singles-training.settings.test.ts`
- Test: `app/tests/pages/singles-training-play-assembly.test.ts`

- [ ] **Step 1: Update settings shell to match score training**

Replace `SinglesTrainingSettingsShell.astro` contents:

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

<main class="mx-auto w-full max-w-2xl p-4 @sm:p-6">
  <form id="game-settings-form" method="POST" action={playUrl} class="space-y-4">
    <slot />
    <PrimaryBtn type="submit" label="Play" />
  </form>
</main>
```

- [ ] **Step 2: Simplify settings page**

In `settings-[game].astro`, remove singles-training active session block:

```typescript
// Remove imports:
// getSinglesTrainingSession, isSinglesTrainingSession

// Remove:
} else if (slug === "singles-training" && session.userId) {
  ...
}
```

Change singles-training branch:

```astro
) : slug === "singles-training" ? (
  <SinglesTrainingSettingsShell game={game}>
    <SettingsForm />
  </SinglesTrainingSettingsShell>
```

- [ ] **Step 3: Remove Alpine settings factory usage**

Delete `app/src/lib/client/alpine/games/singles-training.settings.ts` if no longer referenced.

Remove from `app/src/lib/client/alpine/app.factory.ts`:

```typescript
import { singlesTrainingSettings } from "./games/singles-training.settings";
Alpine.data("singlesTrainingSettings", singlesTrainingSettings);
```

- [ ] **Step 4: Replace settings tests**

Replace `singles-training.settings.test.ts` with assembly-only check, or delete file and add to play assembly test:

```typescript
  it("settings shell uses form POST without resume/abandon", () => {
    const source = readSource(
      "src/components/games/singles-training/SinglesTrainingSettingsShell.astro",
    );
    expect(source).toContain('method="POST"');
    expect(source).toContain("action={playUrl}");
    expect(source).not.toContain("hasActiveSession");
    expect(source).not.toContain("resume()");
    expect(source).not.toContain("abandon()");
  });
```

Update settings page assembly test to remove `getSinglesTrainingSession` / `hasActiveSession` expectations.

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 7: Skeleton Components

**Files:**
- Create: `app/src/components/games/singles-training/PlayShellSkeleton.astro`
- Create: `app/src/components/games/singles-training/SummarySkeleton.astro`

- [ ] **Step 1: Create PlayShellSkeleton**

```astro
---
import Skeleton from "@components/ui/Skeleton.astro";
---

<div class="flex flex-col gap-3 flex-1" data-testid="st-play-shell-skeleton">
  <article class="game-panel p-6 flex flex-col gap-4 items-center">
    <Skeleton variant="block" class="h-16 w-24" />
    <Skeleton variant="text" class="h-4 w-32" />
    <div class="w-full grid grid-cols-2 gap-2">
      <Skeleton variant="text" class="h-4 w-20" />
      <Skeleton variant="text" class="h-4 w-8 justify-self-end" />
      <Skeleton variant="text" class="h-4 w-20" />
      <Skeleton variant="text" class="h-4 w-8 justify-self-end" />
    </div>
  </article>
  <Skeleton variant="text" class="h-6 w-48 mx-auto" />
  <div class="grid grid-cols-3 gap-2">
    <Skeleton variant="block" class="h-10" />
    <Skeleton variant="block" class="h-10" />
    <Skeleton variant="block" class="h-10" />
  </div>
  <article class="game-panel p-4 flex flex-col gap-2">
    <Skeleton variant="block" class="h-12 w-full" />
    <Skeleton variant="block" class="h-12 w-full" />
  </article>
</div>
```

- [ ] **Step 2: Create SummarySkeleton**

```astro
---
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
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
    <Skeleton variant="text" class="h-4 w-24" />
    <Skeleton variant="text" class="h-4 w-12 justify-self-end" />
  </dl>
  <Skeleton variant="text" class="h-4 w-56" />
  <div class="grid grid-cols-2 gap-2">
    <Skeleton variant="block" class="h-10 rounded-full" />
    <Skeleton variant="block" class="h-10 rounded-full" />
  </div>
</article>
```

- [ ] **Step 3: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 8: Refactor Alpine Play Controller

**Files:**
- Modify: `app/src/lib/client/alpine/games/singles-training.play.ts`
- Test: `app/tests/lib/client/alpine/games/singles-training.play.test.ts`

- [ ] **Step 1: Add $persist mock and rewrite failing tests**

At top of `singles-training.play.test.ts`, add Alpine `$persist` mock (copy from `score-training.play.test.ts`).

Replace fetch-based dart/undo/playAgain tests with local behavior tests:

```typescript
import Alpine from "alpinejs";
import {
  singlesTrainingPlay,
  SINGLES_TRAINING_SESSION_KEY,
  clearPersistedSinglesTrainingSession,
} from "@lib/client/alpine/games/singles-training.play";
import { buildSinglesTrainingSession } from "@lib/shared/games/singles-training/session-factory";

beforeAll(() => {
  (Alpine as unknown as Record<string, unknown>).$persist = (value: unknown) => ({
    as: (_key: string) => ({ using: (_storage: Storage) => value }),
  });
});

// Keep getter tests; replace submitDart test:
it("applies dart locally without fetch", () => {
  const play = singlesTrainingPlay(structuredClone(baseSession));
  play.init();
  play.submitDart({ type: "single" });
  expect(fetch).not.toHaveBeenCalled();
  expect(play.session.state.score).toBe(1);
  expect(play.session.state.currentDartInVisit).toBe(1);
});

it("shows summary skeleton gap on terminal dart", async () => {
  let resolveFetch!: (value: Response) => void;
  const fetchPromise = new Promise<Response>((resolve) => {
    resolveFetch = resolve;
  });
  vi.mocked(fetch).mockReturnValue(fetchPromise);

  let session = buildSinglesTrainingSession({
    direction: "low-to-high",
    mode: "hard",
    scoring: "traditional",
  });
  session = applyDartToSession(session, { type: "miss" });
  session = applyDartToSession(session, { type: "miss" });

  const play = singlesTrainingPlay(session);
  play.init();
  play.submitDart({ type: "miss" });

  expect(play.showSummary).toBe(true);
  expect(play.summary).toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    "/api/games/singles-training/complete",
    expect.objectContaining({ method: "POST" }),
  );

  resolveFetch({
    json: async () => ({
      ok: true,
      summary: {
        status: "dead",
        score: 0,
        segmentCounts: { miss: 3, single: 0, double: 0, triple: 0 },
        hitRatio: 0,
        dartPositionSuccessRates: [0, 0, 0],
        targetsCompleted: 0,
        dartsThrown: 3,
      },
    }),
  } as Response);
  await fetchPromise;
  await vi.waitFor(() => expect(play.summary).not.toBeNull());
});

it("undos dart locally without fetch", () => {
  const play = singlesTrainingPlay({
    ...structuredClone(baseSession),
    state: { ...baseSession.state, currentDartInVisit: 1, score: 1 },
    dartHistory: [
      { targetIndex: 0, dartInVisit: 0, outcome: { type: "single" }, points: 1 },
    ],
  });
  play.init();
  play.undoDart();
  expect(fetch).not.toHaveBeenCalled();
  expect(play.session.dartHistory).toEqual([]);
});

it("playAgain rebuilds session without fetch", () => {
  const play = singlesTrainingPlay(structuredClone(baseSession));
  play.init();
  play.showSummary = true;
  play.summary = {
    status: "dead",
    score: 0,
    segmentCounts: { miss: 3, single: 0, double: 0, triple: 0 },
    hitRatio: 0,
    dartPositionSuccessRates: [0, 0, 0],
    targetsCompleted: 0,
    dartsThrown: 3,
  };
  play.playAgain();
  expect(fetch).not.toHaveBeenCalled();
  expect(play.showSummary).toBe(false);
  expect(play.summary).toBeNull();
  expect(play.session.state.status).toBe("active");
  expect(play.session.dartHistory).toEqual([]);
});

it("confirmLeave clears persisted session", () => {
  sessionStorage.setItem(`_${SINGLES_TRAINING_SESSION_KEY}`, "{}");
  const play = singlesTrainingPlay(structuredClone(baseSession));
  play.init();
  play.confirmLeave();
  expect(clearPersistedSinglesTrainingSession).toBeDefined();
  expect(window.location.href).toBe("/games");
});
```

Add `import { applyDartToSession } from "@lib/shared/games/singles-training/state";` where needed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- tests/lib/client/alpine/games/singles-training.play.test.ts`  
Expected: FAIL

- [ ] **Step 3: Rewrite play controller**

Replace `singles-training.play.ts` with client-session implementation:

```typescript
import Alpine from "alpinejs";
import type { ConfirmationModalStore } from "@lib/client/alpine/stores/confirmationModal.store";
import type {
  ApiResponse,
  SinglesTrainingCompleteSuccess,
} from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  formatDartOutcomeLabel,
  isValidOutcomeForTarget,
  type DartOutcome,
} from "@lib/shared/games/singles-training/dart";
import {
  isSinglesTrainingSession,
  type SinglesTrainingSession,
} from "@lib/shared/games/singles-training/session";
import { buildSinglesTrainingSession } from "@lib/shared/games/singles-training/session-factory";
import type { SinglesTrainingSummary } from "@lib/shared/games/singles-training/summary";
import {
  applyDartToSession,
  revertLastDart,
} from "@lib/shared/games/singles-training/state";
import { t } from "@lib/shared/i18n";

export const SINGLES_TRAINING_SESSION_KEY = "singles-training-session";

/** Removes the persisted in-progress session from sessionStorage. */
export function clearPersistedSinglesTrainingSession(): void {
  sessionStorage.removeItem(Alpine.prefixed(SINGLES_TRAINING_SESSION_KEY));
}

/**
 * Alpine state factory for Singles Training play flow.
 *
 * Holds session state client-side via Alpine $persist (sessionStorage).
 * Applies darts locally; POSTs only on completion.
 */
export function singlesTrainingPlay(serverSession: SinglesTrainingSession | null) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: (Alpine as any)
      .$persist(serverSession)
      .as(SINGLES_TRAINING_SESSION_KEY)
      .using(sessionStorage) as SinglesTrainingSession | null,
    loading: false,
    ready: false,
    error: "",
    showSummary: false,
    summary: null as SinglesTrainingSummary | null,

    get controlsDisabled() {
      return (
        !this.ready ||
        this.loading ||
        this.showSummary
      );
    },

    get currentTarget() {
      return this.session?.targetSequence[this.session.state.currentTargetIndex];
    },

    get isBullTarget() {
      return this.currentTarget === "bull";
    },

    get targetDisplay() {
      return this.isBullTarget ? "Bull" : String(this.currentTarget);
    },

    get visitDartLabels() {
      const labels: [string, string, string] = ["-", "-", "-"];
      if (!this.session) return labels;
      for (const dart of this.session.dartHistory) {
        if (dart.targetIndex !== this.session.state.currentTargetIndex) continue;
        labels[dart.dartInVisit] = formatDartOutcomeLabel(
          this.currentTarget!,
          dart.outcome,
        );
      }
      return labels;
    },

    init() {
      if (serverSession) {
        this.session = serverSession;
      }
      if (
        !isSinglesTrainingSession(this.session) ||
        this.session.state.status !== "active"
      ) {
        window.location.href = "/games/settings-singles-training";
        return;
      }
      this.ready = true;
    },

    leave() {
      (Alpine.store("confirmationModal") as ConfirmationModalStore).open({
        title: "Leave game?",
        message: "Your progress in this session will be lost.",
        onConfirm: () => this.confirmLeave(),
      });
    },

    confirmLeave() {
      clearPersistedSinglesTrainingSession();
      window.location.href = "/games";
    },

    submitDart(outcome: DartOutcome) {
      if (!this.session || this.showSummary) return;
      const target = this.session.targetSequence[this.session.state.currentTargetIndex];
      if (!isValidOutcomeForTarget(target, outcome)) return;

      this.session = applyDartToSession(this.session, outcome);

      if (
        this.session.state.status === "completed" ||
        this.session.state.status === "dead"
      ) {
        this.showSummary = true;
        void this.persistCompletion();
      }
    },

    undoDart() {
      if (!this.session || this.session.dartHistory.length === 0 || this.showSummary) {
        return;
      }
      this.session = revertLastDart(this.session);
    },

    async persistCompletion() {
      this.loading = true;
      this.error = "";
      try {
        const response = await fetch("/api/games/singles-training/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: this.session }),
        });
        const data = (await response.json()) as ApiResponse;
        if (!data.ok) {
          this.error = t(data.code ?? MessageCode.SERVER_ERROR);
          return;
        }
        const success = data as SinglesTrainingCompleteSuccess;
        this.summary = success.summary;
        clearPersistedSinglesTrainingSession();
      } catch {
        this.error = t(MessageCode.NETWORK_ERROR);
      } finally {
        this.loading = false;
      }
    },

    playAgain() {
      if (!this.session || !this.summary) return;

      const settings = this.session.settings;
      this.session = buildSinglesTrainingSession(settings);
      this.showSummary = false;
      this.summary = null;
      this.error = "";
    },
  };
}
```

- [ ] **Step 4: Run play tests**

Run: `cd app && npm test -- tests/lib/client/alpine/games/singles-training.play.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 9: Wire Play.astro Skeletons and Summary

**Files:**
- Modify: `app/src/components/games/singles-training/Play.astro`
- Test: `app/tests/pages/singles-training-play-assembly.test.ts`

- [ ] **Step 1: Add assembly test expectations**

```typescript
  it("Play.astro accepts optional gameSession, skeleton shells, and $persist", () => {
    const playSource = readSource("src/components/games/singles-training/Play.astro");
    const factorySource = readSource("src/lib/client/alpine/games/singles-training.play.ts");
    expect(playSource).toContain("gameSession?:");
    expect(playSource).toContain("PlayShellSkeleton");
    expect(playSource).toContain("SummarySkeleton");
    expect(playSource).toContain('x-init="init()"');
    expect(playSource).toContain('x-show="!ready"');
    expect(playSource).toContain('x-show="ready && !showSummary"');
    expect(playSource).toContain('x-show="showSummary && !summary"');
    expect(playSource).toContain('showSummaryModel="showSummary && summary"');
    expect(playSource).toContain('loadingModel="loading"');
    expect(factorySource).toContain("$persist");
    expect(factorySource).toContain(".using(sessionStorage)");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/pages/singles-training-play-assembly.test.ts`  
Expected: FAIL

- [ ] **Step 3: Update Play.astro**

```astro
---
import LeaveIcon from "@icons/leave.svg";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";
import ScorePanel from "./ScorePanel.astro";
import TargetLabel from "./TargetLabel.astro";
import DartInput from "./DartInput.astro";
import Summary from "./Summary.astro";
import PlayShellSkeleton from "./PlayShellSkeleton.astro";
import SummarySkeleton from "./SummarySkeleton.astro";

interface Props {
  displayName: string;
  gameSession?: SinglesTrainingSession | null;
}

const { displayName, gameSession = null } = Astro.props;
const sessionJson = JSON.stringify(gameSession ?? null).replace(/</g, "\\u003c");
---

<section
  class="relative flex-1 h-full flex flex-col gap-4"
  x-data={`singlesTrainingPlay(${sessionJson})`}
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

  <div x-show="ready && !showSummary" x-cloak class="flex flex-col gap-3 flex-1">
    <ScorePanel />
    <TargetLabel />
    <DartInput />
  </div>

  <div x-show="showSummary && !summary" x-cloak>
    <SummarySkeleton />
  </div>
  <Summary showSummaryModel="showSummary && summary" loadingModel="loading" />
  <p x-show="error" x-cloak x-text="error" class="text-sm text-red-400" role="alert"></p>
</section>
```

- [ ] **Step 4: Run assembly test**

Run: `cd app && npm test -- tests/pages/singles-training-play-assembly.test.ts`  
Expected: PASS

- [ ] **Step 5: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 10: Remove Obsolete Routes and Data Layer

**Files:**
- Delete: routes and data layer listed in File Structure Overview
- Delete: obsolete test files listed above

- [ ] **Step 1: Delete files**

```bash
cd app
rm src/pages/api/games/singles-training/session.ts
rm src/pages/api/games/singles-training/session/dart.ts
rm src/pages/api/games/singles-training/session/dart/last.ts
rm src/pages/api/games/singles-training/session/play-again.ts
rm src/lib/server/data/singles-training-session.ts
rm tests/lib/server/data/singles-training-session.test.ts
rm tests/api/games/singles-training/session.test.ts
rm tests/api/games/singles-training/dart.test.ts
rm tests/api/games/singles-training/dart-last.test.ts
rm tests/api/games/singles-training/play-again.test.ts
```

- [ ] **Step 2: Grep for stale imports**

Run: `cd app && rg "singles-training-session|session/dart|session/play-again" src tests`

Fix any remaining imports (e.g. `games.test.ts`, `api/games/index.test.ts`).

- [ ] **Step 3: Run verification gate**

Run: `cd app && npm run check && npm test && npx fallow`

---

### Task 11: Manual Smoke Test

- [ ] **Step 1: Normal mode complete game**

1. `npm run dev` from `app/`
2. Start singles training (low-to-high, normal, traditional)
3. Submit darts — no loading spinner between darts
4. Complete all 21 targets → summary skeleton → summary with stats
5. Click **Yes** → new game, same settings, dart 1 on first target

- [ ] **Step 2: Hard mode game over**

1. Start hard mode
2. Miss 3 darts on target 1 → summary shows "Game Over"
3. Click **No** → `/games`

- [ ] **Step 3: Refresh during play**

1. Start game, submit 2 darts
2. Refresh page → game resumes at dart 3 of current target

- [ ] **Step 4: Leave game**

1. Start game, submit darts, leave via confirmation
2. Return to settings → no resume banner
3. Start new game → fresh session

---

## Self-Review Checklist

| Requirement | Task |
| ----------- | ---- |
| Form POST game start | Task 5, 6 |
| Client `$persist` session | Task 8 |
| Local dart/undo | Task 8 |
| Completion API only DB write | Task 4 |
| Stats + play count on completion | Task 4 |
| Summary skeleton during API | Task 7, 9 |
| Play again client-side | Task 8 |
| Remove resume/abandon | Task 6 |
| Remove DB session layer | Task 10 |
| Leave clears persist | Task 8 |

---

## Final Verification Gate

Run only after Task 11 is complete.

```bash
cd app
npm run check
npm test
npm run build
npx fallow
```

All four must exit 0.

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

## Execution Handoff

**Plan saved to `docs/superpowers/plans/2026-06-22-singles-training-client-session.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — implement all tasks in this session with checkpoints

Which approach?
