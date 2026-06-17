# Screen Carousel Wizard — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-15  
**Branch:** TBD  
**Scope:** Reusable dual-panel screen carousel (motion shell) + ten-up-one-down wizard prototype on `/test` with real UI components

**UI reference:** `app/src/pages/test.astro`, `app/src/components/games/ten-up-one-down/RoundEntryWizard.astro`

---

## 1. Overview

Replace the inconsistent per-screen Alpine `x-transition` approach in `RoundEntryWizard.astro` with a **generic motion shell** that performs simultaneous cross-slide transitions. Branching logic stays in game-specific Alpine code.

**Prototype first** on `test.astro` using real wizard components (`DartCountPicker`, `DoubleGrid`, yes/no buttons). Integrate into `RoundEntryWizard` only after motion and branching are approved.

### Motion rules

| Direction | Outgoing panel | Incoming panel |
|-----------|----------------|----------------|
| Forward | `translateX(0)` → `translateX(-100%)` | `translateX(100%)` → `translateX(0)` |
| Back | `translateX(0)` → `translateX(100%)` | `translateX(-100%)` → `translateX(0)` |

- Both panels visible during transition (simultaneous cross-slide)
- Enter from right / exit left on forward; reversed on back
- Each panel fills parent (`absolute inset-0 w-full h-full`)
- Parent clips overflow (`overflow-hidden`, `relative`)
- `transform` only — no opacity fade
- Duration: `var(--duration-ui)`; easing: `var(--ease-out)`
- `prefers-reduced-motion`: instant swap (existing global CSS rule)

### Interaction rules

- **Advance:** immediate on selection (no Next button)
- **Footer:** fixed outside carousel
  - **Back:** visible when not on first screen (`outcome`)
  - **Submit:** visible only when branch is complete (terminal state); last question panel stays visible — no slide to empty submit screen
- **Rapid input during transition:** ignore navigation until `transitionend`

### Stack

| Item | Value |
|------|-------|
| Framework | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript |
| Pattern | Generic `ScreenCarousel` shell + game-specific wizard Alpine |

---

## 2. Architecture

```
┌─────────────────────────────────────┐
│  ScreenCarousel (motion shell)      │  overflow:hidden, relative, h-full
│  ┌───────────────────────────────┐  │
│  │ active / outgoing panels       │  │  absolute inset-0, w-full h-full
│  │ (1–2 in DOM during transition) │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  Fixed footer (outside carousel)    │  Back | Submit (submit on terminal only)
└─────────────────────────────────────┘
```

**Separation of concerns:**

| Layer | Owns |
|-------|------|
| `screenCarousel()` | Dual-panel render, transform classes, transition lock, `transitionend` cleanup |
| Game wizard Alpine | Form state, branching, `showBack` / `showSubmit`, when to navigate |
| Astro screen wrappers | Markup + `data-screen-id`; slot real picker/grid components |

**Rejected approaches:**

- Per-screen `x-show` + `x-transition` (cannot reliably do simultaneous cross-slide)
- View Transitions API (less vector control, awkward with branching back-nav)
- Linear index track (does not fit branching success/failure paths)

---

## 3. Components

### New files

| File | Role |
|------|------|
| `app/src/components/ui/ScreenCarousel.astro` | Clip container; default slot for `[data-screen-id]` panels |
| `app/src/lib/client/alpine/ui/screen-carousel.ts` | `screenCarousel()` Alpine data factory |
| `app/src/lib/client/alpine/games/ten-up-one-down.wizard-test.ts` | Test-page wizard state + branching (no API) |
| `app/src/pages/test.astro` | Prototype page wiring carousel + real UI + footer |

### Register Alpine component

Add to `app/src/lib/client/alpine/app.factory.ts`:

```ts
Alpine.data("screenCarousel", screenCarousel);
```

### `ScreenCarousel.astro` markup

No `x-init`. Alpine v3 runs `init()` from the data factory automatically on render.

```html
<div
  x-data="screenCarousel()"
  class="relative flex-1 overflow-hidden min-h-0 w-full h-full"
>
  <div class="relative w-full h-full" x-ref="stage"></div>
  <slot />
</div>
```

Screen panels are slotted children, hidden from layout until mounted into the stage by `init()`:

```html
<div data-screen-id="outcome" class="h-full w-full flex flex-col">
  <!-- real UI -->
</div>
```

On `init()`, the carousel:

1. Queries `$el` for `[data-screen-id]` children
2. Stores panel element references in a `Map<string, HTMLElement>`
3. Removes panels from slot flow (or hides slot container) so only the stage shows content
4. Mounts the initial `activeScreen` panel into `x-ref="stage"`

### `screenCarousel()` API

```ts
export function screenCarousel(initialScreen = "outcome") {
  return {
    activeScreen: initialScreen,
    outgoingScreen: null as string | null,
    direction: "forward" as "forward" | "back",
    transitioning: false,
    panels: new Map<string, HTMLElement>(),

    init() {
      // $el is available; discover panels, mount initial screen
    },

    navigate(screenId: string, direction: "forward" | "back") {
      if (this.transitioning) return;
      if (screenId === this.activeScreen) return;
      if (!this.panels.has(screenId)) {
        console.warn(`[screenCarousel] unknown screen: ${screenId}`);
        return;
      }
      // set outgoing + incoming, apply transform classes, listen for transitionend
    },
  };
}
```

Parent wizard triggers navigation via a custom DOM event on the carousel element (nested `x-data` scopes cannot share `$refs` methods directly):

```ts
// wizard handler
this.$refs.carousel?.dispatchEvent(
  new CustomEvent("screen-carousel:navigate", {
    bubbles: false,
    detail: { screenId, direction },
  }),
);
```

Carousel `init()` registers a listener on `$el` for `screen-carousel:navigate` → calls `navigate(detail.screenId, detail.direction)`.

### Reused components (unchanged)

- `DartCountPicker`
- `DoubleGrid`
- `PrimaryBtn`
- `SecondaryBtn`

---

## 4. Ten-up-one-down screen IDs & branching

### Screen registry

| `data-screen-id` | Content |
|------------------|---------|
| `outcome` | Target hit? Yes / No |
| `dartCounts-success` | Darts used + darts on double (success path) |
| `finishedOnDouble` | `DoubleGrid` — finished on double |
| `busted` | Busted? Yes / No |
| `onDouble-failure` | Darts on double 0–3 (busted = yes) |
| `doubleAttempted-busted` | Double attempted (busted = yes, `onDouble > 0`) |
| `dartCounts-failure` | Darts used + darts on double (busted = no) |
| `doubleAttempted-miss` | Double attempted (busted = no, `onDouble > 0`) |

Submit is **not** a carousel screen.

### Success flow

```
outcome (Yes)
  → dartCounts-success
  → finishedOnDouble
  → [terminal: Submit visible in footer, panel stays on finishedOnDouble]
```

### Failure flow

```
outcome (No)
  → busted
  → if busted=yes:
       → onDouble-failure
       → if onDouble > 0: doubleAttempted-busted
       → [terminal: Submit visible]
     if busted=no:
       → dartCounts-failure
       → if onDouble > 0: doubleAttempted-miss
       → [terminal: Submit visible]
```

### Navigation logic

Fork existing rules from `ten-up-one-down.play.ts` (`wizardNext`, `wizardBack`, `tryAdvanceFromDartCounts`, selection handlers) into `ten-up-one-down.wizard-test.ts`. Map internal step + branch state to `screenId` strings.

**Forward:** each handler updates state, computes `nextScreenId`, calls `navigate(nextScreenId, 'forward')`.

**Back:** `wizardBack()` computes previous `screenId` from current state (same rules as play wizard, adapted to finer screen IDs), calls `navigate(prevScreenId, 'back')`.

### Terminal state (`showSubmit`)

Branch is complete when all required fields for that path are set — equivalent to current `step === 'submit'` in play wizard, but **no navigation** to an empty screen. The last question panel remains visible; Submit appears in the fixed footer.

| Branch | Terminal condition |
|--------|-------------------|
| Success | `finishedOnDouble` selected |
| Failure, busted=yes, onDouble=0 | `busted` selected (yes) — skip double-attempt screen |
| Failure, busted=yes, onDouble>0 | `doubleAttempted` selected |
| Failure, busted=no, onDouble=0 | `dartCounts` complete, no double-attempt screen |
| Failure, busted=no, onDouble>0 | `doubleAttempted` selected |

---

## 5. `test.astro` layout

```html
<GameLayout>
  <div x-data="tenUpOneDownWizardTest()" class="...">
    <div class="border w-full min-h-64 flex flex-col">
      <ScreenCarousel x-ref="carousel">
        <!-- data-screen-id panels with real components -->
      </ScreenCarousel>
      <footer class="flex justify-between">
        <SecondaryBtn x-show="showBack" @click="back()" />
        <PrimaryBtn x-show="showSubmit" @click="submit()" />
      </footer>
    </div>
  </div>
</GameLayout>
```

`ScreenCarousel` root carries `x-ref="carousel"` (on the component's outer element). Wizard dispatches `screen-carousel:navigate` on that element.

---

## 6. Error handling

| Case | Behavior |
|------|----------|
| Navigate during active transition | No-op |
| Unknown `screenId` | No-op + `console.warn` in dev |
| `prefers-reduced-motion` | Skip animation; swap panels instantly |
| Missing panel in DOM | No-op + warn |

---

## 7. Testing

### Unit tests — `screen-carousel.ts`

| Test | Assert |
|------|--------|
| `init()` discovers panels | Map populated from `[data-screen-id]` |
| `navigate` forward | Outgoing gets leave-left classes; incoming gets enter-from-right |
| `navigate` back | Reversed transform classes |
| Transition lock | Second `navigate` ignored while `transitioning` |
| Reduced motion | Instant swap, no transition classes |

### Manual — `/test`

- [ ] Success path: outcome → dart counts → finished on double → Submit appears, panel stays
- [ ] Failure busted=yes, onDouble=0: outcome → busted → Submit
- [ ] Failure busted=yes, onDouble>0: through double attempted
- [ ] Failure busted=no paths with/without double attempt
- [ ] Back through each path reverses animation
- [ ] Rapid taps do not break panel state
- [ ] Panels fill `min-h-64` container

### Integration (post-approval)

Replace `RoundEntryWizard.astro` internals with `ScreenCarousel` + existing `tenUpOneDownPlay` branching refactor.

---

## 8. Out of scope

- API submit/undo on test page (stub `submit()` with `console.log` or toast)
- Other game modes using carousel (future reuse only)
- Changing wizard business rules or validation
- Replacing `RoundEntryWizard` in production until test page is approved
