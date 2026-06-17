# Confirmation Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task subagent requirements (all mandatory):**
>
> 1. **test-driven-development** — for any task that writes or changes code
> 2. **verification-before-completion** — run the full Verification Gate (below) immediately before marking the task done or committing; no completion claims without fresh command output
>
> A task is **not complete** until its Verification Gate step passes with evidence recorded in the subagent's final report.

**Goal:** Ship a reusable global confirmation modal (Alpine store + Astro component) mounted in `BaseLayout`, with Ten Up One Down `leave()` as the first consumer.

**Architecture:** `confirmationModal` Alpine store exposes `open({ title, message, onConfirm, onCancel? })`, `confirm()`, and `cancel()`. `ConfirmationModal.astro` binds to `$store.confirmationModal`. Any feature opens the modal via `this.$store.confirmationModal.open(...)`.

**Tech Stack:** Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript, Vitest, jsdom, curl (SSR smoke)

**Branch:** `ten-up-one-down-settings` (or current feature branch)  
**Spec:** `docs/superpowers/specs/2026-06-15-confirmation-modal-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

---

## Verification Gate (every task)

**Iron law:** No completion claims without fresh verification evidence from this session.

### 1. Static analysis (strict)

```bash
cd app && npm run check
```

**Required output tail (all three must be 0):**

```
Result (N files):
- 0 errors
- 0 warnings
- 0 hints
```

### 2. Unit / integration tests

```bash
cd app && npm test
```

Required: exit code 0, 0 failures.

### 3. Production build

```bash
cd app && npm run build
```

Required: exit code 0.

### 4. Curl smoke (every task)

**Prerequisites:** Dev server running in background (`cd app && npm run dev`, default `http://localhost:4321`). Credentials from `app/.env` or defaults: `testuser` / `testpass`.

```bash
cd app && ./scripts/curl-verify-tuod.sh
```

Required: exit code 0, all `PASS:` lines green. Tasks that add new assertions must extend the script first; earlier tasks run the script as-is (must still pass).

**Combined gate (paste full output in subagent report):**

```bash
cd app && npm run check && npm test && npm run build && ./scripts/curl-verify-tuod.sh
```

### Dispatcher handoff prompt

```
REQUIRED SUB-SKILLS: test-driven-development (code tasks), verification-before-completion (always).
Implement Task N from docs/superpowers/plans/2026-06-15-confirmation-modal.md only.
Before reporting complete: run the Verification Gate (npm run check → npm test → npm run build → ./scripts/curl-verify-tuod.sh).
npm run check MUST show 0 errors, 0 warnings, 0 hints.
Dev server MUST be running for curl step.
Include fresh command output as evidence. Do not claim success without it.
Commit only the files for this task with a focused message.
```

---

## File Structure Overview


| File                                                             | Responsibility                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/lib/client/alpine/stores/confirmationModal.store.ts`        | Global store: `open`, `confirm`, `cancel`, `reset`, `init` effect |
| `src/lib/client/alpine/app.factory.ts`                           | Register store with `confirmationModalState(Alpine)`              |
| `src/components/ui/ConfirmationModal.astro`                      | Fixed overlay UI bound to `$store.confirmationModal`              |
| `src/layouts/BaseLayout.astro`                                   | Mount `<ConfirmationModal />` on every page                       |
| `src/lib/client/alpine/games/ten-up-one-down.play.ts`            | `leave()` opens modal; `confirmLeave()` navigates                 |
| `scripts/curl-verify-tuod.sh`                                    | SSR smoke — extended with confirmation-modal + leave assertions   |
| `tests/lib/client/alpine/stores/confirmationModal.store.test.ts` | Store unit tests                                                  |
| `tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`     | `leave()` integration test                                        |


---

### Task 1: Confirmation Modal Store

**Files:**

- Modify: `app/src/lib/client/alpine/stores/confirmationModal.store.ts`
- Modify: `app/src/lib/client/alpine/app.factory.ts`
- Create: `app/tests/lib/client/alpine/stores/confirmationModal.store.test.ts`

- [ ] **Step 1: Write the failing store tests**

```ts
// app/tests/lib/client/alpine/stores/confirmationModal.store.test.ts
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Alpine as AlpineType } from "alpinejs";
import { confirmationModalState } from "@lib/client/alpine/stores/confirmationModal.store";

describe("confirmationModalState", () => {
  let Alpine: { effect: (fn: () => void) => void };
  let store: ReturnType<typeof confirmationModalState>;

  beforeEach(() => {
    vi.useFakeTimers();
    Alpine = {
      effect: (fn) => {
        fn();
      },
    };
    store = confirmationModalState(Alpine as unknown as AlpineType);
    store.init();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("open sets title, message, labels, and showModal", () => {
    store.open({
      title: "Leave game?",
      message: "Progress will be lost.",
      onConfirm: vi.fn(),
      confirmLabel: "Yes",
      cancelLabel: "No",
    });

    expect(store.showModal).toBe(true);
    expect(store.title).toBe("Leave game?");
    expect(store.message).toBe("Progress will be lost.");
    expect(store.confirmLabel).toBe("Yes");
    expect(store.cancelLabel).toBe("No");
  });

  it("open uses default button labels", () => {
    store.open({
      title: "T",
      message: "M",
      onConfirm: vi.fn(),
    });

    expect(store.confirmLabel).toBe("Confirm");
    expect(store.cancelLabel).toBe("Cancel");
  });

  it("confirm calls onConfirm then closes modal", () => {
    const onConfirm = vi.fn();
    store.open({
      title: "T",
      message: "M",
      onConfirm,
    });

    store.confirm();

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(store.showModal).toBe(false);
  });

  it("cancel calls optional onCancel then closes modal", () => {
    const onCancel = vi.fn();
    store.open({
      title: "T",
      message: "M",
      onConfirm: vi.fn(),
      onCancel,
    });

    store.cancel();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(store.showModal).toBe(false);
  });

  it("cancel closes without onCancel", () => {
    store.open({
      title: "T",
      message: "M",
      onConfirm: vi.fn(),
    });

    store.cancel();

    expect(store.showModal).toBe(false);
  });

  it("reset clears public fields after close", () => {
    store.open({
      title: "T",
      message: "M",
      onConfirm: vi.fn(),
      confirmLabel: "Go",
      cancelLabel: "Stop",
    });
    store.cancel();
    vi.advanceTimersByTime(100);

    expect(store.title).toBe("");
    expect(store.message).toBe("");
    expect(store.confirmLabel).toBe("Confirm");
    expect(store.cancelLabel).toBe("Cancel");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app && npm test -- tests/lib/client/alpine/stores/confirmationModal.store.test.ts
```

Expected: FAIL — `open`, `confirm`, `cancel` not defined on store.

- [ ] **Step 3: Implement store and fix factory registration**

Replace `app/src/lib/client/alpine/stores/confirmationModal.store.ts` with:

```ts
import type { Alpine } from "alpinejs";

export type OpenOptions = {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

type StoredCallbacks = {
  onConfirm: () => void;
  onCancel?: () => void;
};

export function confirmationModalState(Alpine: Alpine) {
  let callbacks: StoredCallbacks = { onConfirm: () => {} };

  const store = {
    showModal: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",

    init() {
      Alpine.effect(() => {
        if (!store.showModal) {
          setTimeout(() => {
            store.reset();
          }, 100);
        }
      });
    },

    open(options: OpenOptions) {
      callbacks = {
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
      };
      store.title = options.title;
      store.message = options.message;
      store.confirmLabel = options.confirmLabel ?? "Confirm";
      store.cancelLabel = options.cancelLabel ?? "Cancel";
      store.showModal = true;
    },

    confirm() {
      callbacks.onConfirm();
      store.showModal = false;
    },

    cancel() {
      callbacks.onCancel?.();
      store.showModal = false;
    },

    reset() {
      store.title = "";
      store.message = "";
      store.confirmLabel = "Confirm";
      store.cancelLabel = "Cancel";
      callbacks = { onConfirm: () => {} };
    },
  };

  return store;
}
```

Fix `app/src/lib/client/alpine/app.factory.ts` line 23:

```ts
const confirmationModal = confirmationModalState(Alpine);
Alpine.store("confirmationModal", confirmationModal);
confirmationModal.init();
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && npm test -- tests/lib/client/alpine/stores/confirmationModal.store.test.ts
```

Expected: PASS (all tests in file).

- [ ] **Step 5: Verification Gate**

Start dev server if not running:

```bash
cd app && npm run dev
```

In a second terminal:

```bash
cd app && npm run check && npm test && npm run build && ./scripts/curl-verify-tuod.sh
```

Expected: all pass; curl unchanged from baseline.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/client/alpine/stores/confirmationModal.store.ts \
        app/src/lib/client/alpine/app.factory.ts \
        app/tests/lib/client/alpine/stores/confirmationModal.store.test.ts
git commit -m "feat: add confirmation modal Alpine store with open/confirm/cancel"
```

---

### Task 2: ConfirmationModal Component

**Files:**

- Modify: `app/src/components/ui/ConfirmationModal.astro`

- [ ] **Step 1: Replace component markup per spec**

Replace entire file with:

```astro
---
---

<div
  data-testid="confirmation-modal"
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
  x-show="$store.confirmationModal.showModal"
  x-cloak
  @keydown.escape.window="$store.confirmationModal.cancel()"
>
  <div class="card-interactive w-full max-w-sm rounded-md p-4" @click.stop>
    <h2
      class="text-lg font-semibold"
      x-text="$store.confirmationModal.title"
    ></h2>
    <p
      class="text-sm text-text-muted"
      x-text="$store.confirmationModal.message"
    ></p>
    <div class="mt-4 flex gap-4">
      <button
        type="button"
        class="btn-secondary btn-press w-full"
        @click="$store.confirmationModal.cancel()"
        x-text="$store.confirmationModal.cancelLabel"
      ></button>
      <button
        type="button"
        class="btn-primary btn-press w-full"
        @click="$store.confirmationModal.confirm()"
        x-text="$store.confirmationModal.confirmLabel"
      ></button>
    </div>
  </div>
</div>
```

Note: Use inline buttons with `x-text` for dynamic labels — `PrimaryBtn`/`SecondaryBtn` take static Astro `label` props.

- [ ] **Step 2: Verification Gate**

```bash
cd app && npm run check && npm test && npm run build && ./scripts/curl-verify-tuod.sh
```

Expected: all pass (component not mounted yet — no new curl assertions).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ui/ConfirmationModal.astro
git commit -m "feat: add ConfirmationModal component bound to Alpine store"
```

---

### Task 3: Mount in BaseLayout + Curl Assertions

**Files:**

- Modify: `app/src/layouts/BaseLayout.astro`
- Modify: `app/scripts/curl-verify-tuod.sh`

- [ ] **Step 1: Mount ConfirmationModal in BaseLayout**

```astro
---
import "@styles/global.css";
import ConfirmationModal from "@components/ui/ConfirmationModal.astro";

const url = Astro.url;
// ... existing title logic unchanged ...
---

<html lang="en">
  <head>
    <!-- existing head unchanged -->
  </head>
  <body class="flex min-h-dvh flex-col">
    <slot />
    <ConfirmationModal />
  </body>
</html>
```

- [ ] **Step 2: Extend curl script with global modal assertions**

Add after the play-page HTML fetch (`HTML=$(curl ... ten-up-one-down)`):

```bash
assert_contains "$HTML" 'data-testid="confirmation-modal"' "play page includes global ConfirmationModal"
assert_contains "$HTML" '$store.confirmationModal.showModal' "ConfirmationModal binds to store"
```

Add after login block (games list — confirms BaseLayout mount on non-play pages):

```bash
GAMES_HTML=$(curl -sf -b "$JAR" "$BASE_URL/games")
assert_contains "$GAMES_HTML" 'data-testid="confirmation-modal"' "games list includes global ConfirmationModal"
```

- [ ] **Step 3: Verification Gate**

```bash
cd app && npm run check && npm test && npm run build && ./scripts/curl-verify-tuod.sh
```

Expected: all `PASS:` including new confirmation-modal lines.

- [ ] **Step 4: Commit**

```bash
git add app/src/layouts/BaseLayout.astro app/scripts/curl-verify-tuod.sh
git commit -m "feat: mount ConfirmationModal in BaseLayout with curl smoke"
```

---

### Task 4: Wire leave() in Ten Up One Down Play

**Files:**

- Modify: `app/src/lib/client/alpine/games/ten-up-one-down.play.ts`
- Modify: `app/tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`
- Modify: `app/scripts/curl-verify-tuod.sh`

- [ ] **Step 1: Write the failing leave test**

Add to `app/tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`:

```ts
  it("leave opens confirmation modal and confirmLeave navigates", () => {
    const open = vi.fn();
    const play = tenUpOneDownPlay(structuredClone(roundsSession)) as ReturnType<
      typeof tenUpOneDownPlay
    > & {
      $store: { confirmationModal: { open: typeof open } };
    };
    play.$store = { confirmationModal: { open } };

    play.leave();

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith({
      title: "Leave game?",
      message: "Your progress in this session will be lost.",
      onConfirm: expect.any(Function),
    });

    const { onConfirm } = open.mock.calls[0]![0] as { onConfirm: () => void };
    onConfirm();
    expect(window.location.href).toBe("/games");
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npm test -- tests/lib/client/alpine/games/ten-up-one-down.play.test.ts -t "leave opens"
```

Expected: FAIL — `leave()` does not call `open`.

- [ ] **Step 3: Implement leave()**

Replace the `leave()` stub in `app/src/lib/client/alpine/games/ten-up-one-down.play.ts`:

```ts
    leave() {
      this.$store.confirmationModal.open({
        title: "Leave game?",
        message: "Your progress in this session will be lost.",
        onConfirm: () => this.confirmLeave(),
      });
    },
```

Add Alpine `$store` typing at top of factory return if `npm run check` reports errors — use a minimal interface:

```ts
type PlayAlpineContext = {
  $store: {
    confirmationModal: {
      open: (options: {
        title: string;
        message: string;
        onConfirm: () => void;
      }) => void;
    };
  };
};
```

Cast `this` in `leave()` only if needed: `(this as typeof this & PlayAlpineContext)`.

Prefer importing `OpenOptions` from the store and using `this as typeof this & { $store: { confirmationModal: { open: (o: OpenOptions) => void } } }` only when check requires it.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app && npm test -- tests/lib/client/alpine/games/ten-up-one-down.play.test.ts -t "leave opens"
```

Expected: PASS.

- [ ] **Step 5: Add leave-button curl assertion**

In `app/scripts/curl-verify-tuod.sh`, after play HTML assertions:

```bash
assert_contains "$HTML" '@click="leave()"' "play page wires leave button to Alpine"
```

- [ ] **Step 6: Verification Gate**

```bash
cd app && npm run check && npm test && npm run build && ./scripts/curl-verify-tuod.sh
```

Expected: all pass including leave-button assertion.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/client/alpine/games/ten-up-one-down.play.ts \
        app/tests/lib/client/alpine/games/ten-up-one-down.play.test.ts \
        app/scripts/curl-verify-tuod.sh
git commit -m "feat: wire ten-up-one-down leave to confirmation modal"
```

---

### Task 5: Final Verification & Spec Checklist

**Files:** none (verification only)

- [ ] **Step 1: Run full Verification Gate**

Dev server running. Single command:

```bash
cd app && npm run check && npm test && npm run build && ./scripts/curl-verify-tuod.sh
```

Record full output in report.

- [ ] **Step 2: Spec coverage checklist**


| Spec § | Requirement                                                 | Verified by                |
| ------ | ----------------------------------------------------------- | -------------------------- |
| §2     | Global store + BaseLayout mount                             | Task 3 curl + Task 1 store |
| §3     | `open`, `confirm` (execute + close), `cancel`, reset effect | Task 1 tests               |
| §4     | Component: fixed overlay, escape, testid, `$store` bindings | Task 2 + Task 3 curl       |
| §5     | BaseLayout integration                                      | Task 3                     |
| §6     | `leave()` → `open()` → `confirmLeave()`                     | Task 4 tests + curl        |
| §7     | Factory passes `Alpine`, calls `init()`                     | Task 1                     |
| §8     | Store + play tests                                          | Tasks 1, 4                 |


- [ ] **Step 3: Manual spot-check (optional, non-blocking)**

With dev server: open `/games/ten-up-one-down`, click leave icon, confirm modal appears, Cancel dismisses, Confirm navigates to `/games`.

- [ ] **Step 4: Commit plan completion note (if any fixups)**

Only if Step 1 required fixes:

```bash
git add -A && git commit -m "fix: address confirmation modal verification findings"
```

---

## Spec Coverage Self-Review


| Spec section      | Task          |
| ----------------- | ------------- |
| §1 Overview       | Tasks 1–5     |
| §2 Architecture   | Tasks 1, 3    |
| §3 Store API      | Task 1        |
| §4 Component      | Task 2        |
| §5 Layout         | Task 3        |
| §6 Leave consumer | Task 4        |
| §7 Factory fix    | Task 1        |
| §8 Testing        | Tasks 1, 4, 5 |


No placeholders. All file paths absolute to `app/`. Type names consistent: `OpenOptions`, `confirmationModalState`, `$store.confirmationModal`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-15-confirmation-modal.md`.**

**Recommended: Subagent-Driven** — dispatch one fresh subagent per task (Tasks 1–5) with the Dispatcher handoff prompt. Parent runs two-stage review (spec compliance, then code quality) after each task. **Every task ends with the full Verification Gate** (`npm run check` → `npm test` → `npm run build` → `./scripts/curl-verify-tuod.sh` with dev server up).

**Alternative: Inline Execution** — use `superpowers:executing-plans` in this session with the same per-task gate.

**Which approach?**