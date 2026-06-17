# Confirmation Modal — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-15  
**Branch:** TBD  
**Scope:** Reusable global confirmation modal (Alpine store + Astro component) with first consumer: Ten Up One Down leave flow

**UI reference:** `app/src/components/ui/ConfirmationModal.astro`, `app/src/lib/client/alpine/stores/confirmationModal.store.ts`

---

## 1. Overview

Add a **global confirmation modal** that any Alpine component can open with a title, message, and confirm callback. First use case: warn before leaving an in-progress Ten Up One Down session.

| Item | Value |
|------|-------|
| Stack | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| State | Alpine global store (`confirmationModal`) |
| Mount point | `BaseLayout.astro` (available on every page) |
| Pattern | `open()` imperative API; component binds via `$store` |

**Out of scope:** i18n for button labels (hardcoded English for now); destructive/red button variant; backdrop click to dismiss.

---

## 2. Architecture

```
BaseLayout
  └── ConfirmationModal.astro          ← binds to $store.confirmationModal

any Alpine component (e.g. tenUpOneDownPlay)
  └── this.$store.confirmationModal.open({ title, message, onConfirm })
```

- Store registered in `app.factory.ts`: `Alpine.store("confirmationModal", confirmationModalState(Alpine))`
- `confirmationModalState` receives `Alpine` so `init()` can register a reactive `Alpine.effect` for post-close reset
- Overlay uses **`fixed inset-0 z-50`** (not `absolute`) so it covers the full viewport from `BaseLayout`
- Coexists with per-page modals (e.g. `OptionModal` on play screen) — separate state, separate z-index layers if both open (unlikely in practice)

---

## 3. Store API

**File:** `app/src/lib/client/alpine/stores/confirmationModal.store.ts`

### 3.1 Public state (bound in template)

| Field | Type | Description |
|-------|------|-------------|
| `showModal` | `boolean` | Visibility |
| `title` | `string` | Heading |
| `message` | `string` | Body copy |
| `confirmLabel` | `string` | Confirm button text (default `"Confirm"`) |
| `cancelLabel` | `string` | Cancel button text (default `"Cancel"`) |

### 3.2 Methods

```ts
type OpenOptions = {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

open(options: OpenOptions): void
confirm(): void
cancel(): void
```

| Method | Behavior |
|--------|----------|
| `open()` | Stores callbacks internally, sets title/message/labels, `showModal = true` |
| `confirm()` | Calls stored `onConfirm`, then `showModal = false` (triggers reset via §3.3) |
| `cancel()` | Calls stored `onCancel` if provided, then `showModal = false` |

Callbacks are held in closure/private fields inside `open()` — not exposed on store state.

### 3.3 Reset lifecycle

`init()` registers `Alpine.effect(() => { if (!showModal) setTimeout(reset, 100) })`.

- 100ms delay allows exit transition before clearing title/message/labels/callbacks
- `reset()` clears all public fields and callback references

---

## 4. Component

**File:** `app/src/components/ui/ConfirmationModal.astro`

- No `x-data` wrapper — bind directly to `$store.confirmationModal`
- Overlay: `fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4`
- Card: `card-interactive rounded-md p-4 w-full max-w-sm` with `@click.stop`
- Title: `x-text="$store.confirmationModal.title"`
- Message: `x-text="$store.confirmationModal.message"` with `text-text-muted`
- Buttons: horizontal `flex gap-2` row
  - Cancel → `@click="$store.confirmationModal.cancel()"` via `SecondaryBtn`
  - Confirm → `@click="$store.confirmationModal.confirm()"` via `PrimaryBtn` with `type="button"`
- Escape → `@keydown.escape.window="$store.confirmationModal.cancel()"`
- Backdrop click does **not** dismiss
- `x-cloak` on overlay
- `data-testid="confirmation-modal"`

---

## 5. Layout integration

**File:** `app/src/layouts/BaseLayout.astro`

Import and render `<ConfirmationModal />` as last child inside `<body>`, after `<slot />`.

---

## 6. First consumer: leave game

**File:** `app/src/lib/client/alpine/games/ten-up-one-down.play.ts`

```ts
leave() {
  this.$store.confirmationModal.open({
    title: "Leave game?",
    message: "Your progress in this session will be lost.",
    onConfirm: () => this.confirmLeave(),
  });
}
```

`confirmLeave()` unchanged — sets `window.location.href = "/games"`. `confirm()` closes the modal before navigation; page unmount makes the subsequent reset redundant but harmless.

**File:** `app/src/components/games/ten-up-one-down/Play.astro` — no changes beyond existing leave button (`@click="leave()"`).

---

## 7. Factory fix

**File:** `app/src/lib/client/alpine/app.factory.ts`

Current registration calls `confirmationModalState()` without `Alpine`. Fix:

```ts
Alpine.store("confirmationModal", confirmationModalState(Alpine));
```

---

## 8. Testing

### 8.1 Store unit tests

**File:** `app/tests/lib/client/alpine/stores/confirmationModal.store.test.ts`

| Case | Assertion |
|------|-----------|
| `open()` | Sets `title`, `message`, `showModal = true`, default labels |
| `open()` with custom labels | Sets `confirmLabel`, `cancelLabel` |
| `confirm()` | Calls `onConfirm` callback, then sets `showModal = false` |
| `cancel()` | Calls optional `onCancel`, sets `showModal = false` |
| `reset()` | Clears all public fields |

Mock `Alpine.effect` in tests where `init()` is exercised.

### 8.2 Play integration test

**File:** `app/tests/lib/client/alpine/games/ten-up-one-down.play.test.ts`

| Case | Assertion |
|------|-----------|
| `leave()` | Calls `$store.confirmationModal.open` with title/message |
| `leave()` onConfirm | Invokes `confirmLeave` (navigates to `/games`) |

Mock `$store.confirmationModal` on the play instance before calling `leave()`.

---

## 9. Files touched

| File | Change |
|------|--------|
| `confirmationModal.store.ts` | Add `open()`, `confirm()`, `cancel()`; internal callback storage; export `OpenOptions` type |
| `ConfirmationModal.astro` | Fix `$store` bindings; `fixed` overlay; escape handler; testid |
| `app.factory.ts` | Pass `Alpine` to `confirmationModalState` |
| `BaseLayout.astro` | Mount `<ConfirmationModal />` |
| `ten-up-one-down.play.ts` | Implement `leave()` via `open()` |
| `confirmationModal.store.test.ts` | New |
| `ten-up-one-down.play.test.ts` | Add leave test |
