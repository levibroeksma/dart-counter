# Theme Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Dart Counter from bespoke slate/sky tokens to a shadcn-style always-dark theme (mirage surfaces + radical-red accents) with pub/venue typography, retokenizing all components in one pass.

**Architecture:** Single `:root` HSL block in `global.css` feeds shadcn `@theme` color utilities. Legacy class names (`bg-surface-page`, `text-text-primary`, etc.) are fully removed — no alias bridge. Component utility classes (`.btn-primary`, `.card`) are updated to use new tokens. Fonts load via Google Fonts in `BaseLayout.astro`.

**Tech Stack:** Astro 6, Tailwind CSS 4, tailwindcss-animate, Alpine.js 3, Vitest

**Spec:** `docs/superpowers/specs/2026-06-30-theme-rebrand-design.md`  
**Palette source:** `design-utils/UI-colors.md`  
**Working directory:** `app/`

---

## File Structure Overview

| File | Responsibility |
| ---- | -------------- |
| `package.json` | Add `tailwindcss-animate` devDependency |
| `src/styles/global.css` | shadcn token hub, `:root` palette, component classes |
| `src/layouts/BaseLayout.astro` | Google Fonts preconnect + stylesheet links |
| `src/components/layout/` | `AppHeader`, `BottomNav`, `NavBtn` — background + nav active color |
| `src/components/ui/` | `Input`, `NumberInputPad`, `RadioCard`, `ConfirmationModal` |
| `src/components/forms/LoginForm.astro` | Login page tokens |
| `src/components/auth/` | `UserMenu`, `LogoutBtn` |
| `src/components/settings/DisplayNameSetting.astro` | Settings card tokens |
| `src/components/games/**` | All game shells, summaries, modals (~30 files) |
| `src/pages/index.astro` | Home page tokens + display typography |
| `tests/styles/theme-tokens.test.ts` | Assert `global.css` + `BaseLayout` wiring |

---

## Verification Gate (final task)

```bash
cd app && npm run check && npm test && npx fallow && npm run lint && ./scripts/audit-imports.sh
```

Confirm zero legacy token references:

```bash
cd app && rg 'surface-page|surface-card|surface-input|surface-elevated|text-text-primary|text-text-muted|bg-accent|accent-hover|text-error' src/
```

Expected: no matches in `src/`

**Manual smoke** (dev server in another terminal):

- `/` — mirage-950 background, Bebas section headings, mono stat values
- `/login` — gradient primary button, input focus ring (radical red)
- `/games/settings-501` — cards, radio selection states
- Bottom nav active icon — radical red

---

### Task 1: Add tailwindcss-animate

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install dependency**

```bash
cd app && npm install -D tailwindcss-animate
```

Expected: `package.json` devDependencies includes `"tailwindcss-animate": "^1.x"`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tailwindcss-animate for theme skeleton"
```

---

### Task 2: Rewrite global.css

**Files:**
- Modify: `app/src/styles/global.css` (full replace)

- [ ] **Step 1: Replace `global.css` with shadcn skeleton + mirage/radical-red palette**

Replace the entire file with:

```css
@import "tailwindcss";
@plugin "tailwindcss-animate";

@theme {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));

  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));

  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));

  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));

  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));

  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));

  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));

  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));

  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));

  --color-chart-1: hsl(var(--chart-1));
  --color-chart-2: hsl(var(--chart-2));
  --color-chart-3: hsl(var(--chart-3));
  --color-chart-4: hsl(var(--chart-4));
  --color-chart-5: hsl(var(--chart-5));

  --color-sidebar: hsl(var(--sidebar-background));
  --color-sidebar-foreground: hsl(var(--sidebar-foreground));
  --color-sidebar-primary: hsl(var(--sidebar-primary));
  --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
  --color-sidebar-accent: hsl(var(--sidebar-accent));
  --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
  --color-sidebar-border: hsl(var(--sidebar-border));
  --color-sidebar-ring: hsl(var(--sidebar-ring));

  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);

  --font-display: "Bebas Neue", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

  --shadow-card: var(--app-shadow-card);
  --shadow-menu: var(--app-shadow-menu);

  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;

  @keyframes accordion-down {
    from {
      height: 0;
    }
    to {
      height: var(--radix-accordion-content-height);
    }
  }

  @keyframes accordion-up {
    from {
      height: var(--radix-accordion-content-height);
    }
    to {
      height: 0;
    }
  }
}

/*
  Tailwind v4 border default is currentColor — restore explicit border color.
*/
@layer base {
  *,
  ::after,
  ::before,
  ::backdrop,
  ::file-selector-button {
    border-color: hsl(var(--border));
  }
}

@layer base {
  :root {
    color-scheme: dark;

    --background: 220 44% 13%;
    --foreground: 210 75% 97%;
    --card: 219 50% 33%;
    --card-foreground: 209 73% 93%;
    --popover: 219 50% 33%;
    --popover-foreground: 209 73% 93%;
    --primary: 346 90% 57%;
    --primary-foreground: 0 0% 100%;
    --secondary: 220 55% 40%;
    --secondary-foreground: 210 75% 97%;
    --muted: 219 50% 33%;
    --muted-foreground: 207 73% 68%;
    --accent: 220 55% 40%;
    --accent-foreground: 210 75% 97%;
    --destructive: 342 84% 41%;
    --destructive-foreground: 0 0% 100%;
    --border: 220 55% 40%;
    --input: 220 55% 40%;
    --ring: 346 90% 57%;
    --radius: 0.5rem;

    --chart-1: 346 90% 57%;
    --chart-2: 207 73% 68%;
    --chart-3: 219 50% 33%;
    --chart-4: 342 84% 41%;
    --chart-5: 220 55% 40%;

    --sidebar-background: 220 44% 13%;
    --sidebar-foreground: 209 73% 93%;
    --sidebar-primary: 346 90% 57%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 219 50% 33%;
    --sidebar-accent-foreground: 209 73% 93%;
    --sidebar-border: 220 55% 40%;
    --sidebar-ring: 346 90% 57%;

    --gradient-primary: linear-gradient(
      135deg,
      hsl(343 78% 50%) 0%,
      hsl(346 90% 57%) 100%
    );
    --app-shadow-card: 0 1px 3px hsl(220 44% 5% / 0.4);
    --app-shadow-menu: 0 4px 16px hsl(220 44% 5% / 0.5);

    --duration-fast: 160ms;
    --duration-ui: 200ms;

    button,
    [role="button"] {
      touch-action: manipulation;
    }
  }

  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    touch-action: manipulation;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  body {
    @apply bg-background text-foreground font-sans;
    min-height: 100dvh;
  }

  ::selection {
    background-color: hsl(var(--primary) / 0.35);
  }

  :focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  [x-cloak] {
    display: none !important;
  }
}

@layer components {
  .btn-press {
    transition: transform var(--duration-fast) var(--ease-out);
  }

  .btn-press:active:not(:disabled) {
    transform: scale(0.97);
  }

  .btn-primary {
    @apply rounded-full px-4 py-2.5 font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70;
    background: var(--gradient-primary);
  }

  .btn-secondary {
    @apply rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground;
  }

  .link-subtle {
    @apply text-sm text-muted-foreground;
  }

  .nav-link-inactive {
    @apply text-muted-foreground;
  }

  .section-label {
    @apply font-display text-sm uppercase tracking-wider text-muted-foreground;
  }

  .game-panel {
    @apply h-fit rounded-lg border border-border bg-card shadow-card;
  }

  .checkout-hint {
    @apply flex min-h-10 w-2/3 items-center justify-center gap-2 rounded-lg bg-muted p-1 font-mono text-sm;
  }

  .card {
    @apply rounded-xl border border-border bg-card shadow-card;
  }

  .card-interactive {
    @apply w-full cursor-pointer rounded-xl border border-border bg-card p-4 shadow-card;
    transition:
      transform var(--duration-fast) var(--ease-out),
      background-color var(--duration-ui) var(--ease-out),
      color var(--duration-ui) var(--ease-out);
  }

  .toast-panel {
    transform-origin: bottom center;
  }

  @media (hover: hover) and (pointer: fine) {
    .btn-primary:not(:disabled) {
      transition:
        transform var(--duration-fast) var(--ease-out),
        filter var(--duration-ui) var(--ease-out);
    }

    .btn-primary:not(:disabled):hover {
      filter: brightness(1.1);
    }

    .link-subtle {
      transition: color var(--duration-ui) var(--ease-out);
    }

    .link-subtle:hover {
      @apply text-foreground;
    }

    .nav-link-inactive {
      transition: color var(--duration-ui) var(--ease-out);
    }

    .nav-link-inactive:hover {
      @apply text-primary;
    }

    .icon-btn-hover {
      transition:
        color var(--duration-ui) var(--ease-out),
        background-color var(--duration-ui) var(--ease-out);
    }

    .icon-btn-hover:hover:not(:disabled) {
      @apply bg-muted text-primary;
    }

    .menu-item-hover {
      transition: background-color var(--duration-fast) var(--ease-out);
    }

    .menu-item-hover:hover {
      @apply bg-muted;
    }

    .game-card-link {
      transition: color var(--duration-ui) var(--ease-out);
    }

    .game-card-link:hover {
      @apply text-primary;
    }
  }

  .input-field {
    @apply w-full rounded-md border border-input bg-muted px-3 py-2 text-foreground;
    transition:
      border-color var(--duration-ui) var(--ease-out),
      box-shadow var(--duration-ui) var(--ease-out);
  }

  .input-field:focus {
    @apply border-primary outline-none;
    box-shadow: 0 0 0 3px hsl(var(--ring) / 0.4);
  }

  .spinner {
    @apply inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent;
  }

  .menu-panel {
    transform-origin: top right;
  }

  .transition-fade-scale-enter {
    transition:
      transform var(--duration-ui) var(--ease-out),
      opacity var(--duration-ui) var(--ease-out);
  }

  .transition-fade-scale-leave {
    transition:
      transform 150ms var(--ease-out),
      opacity 150ms var(--ease-out);
  }

  .skeleton {
    @apply animate-pulse bg-muted;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .btn-press:active:not(:disabled) {
    transform: none;
  }
}
```

- [ ] **Step 2: Verify CSS builds**

```bash
cd app && npm run build
```

Expected: build succeeds (components still use legacy classes in markup — visual breakage OK until Task 5)

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(theme): adopt shadcn token hub with mirage/radical-red palette"
```

---

### Task 3: Load display + body fonts

**Files:**
- Modify: `app/src/layouts/BaseLayout.astro`

- [ ] **Step 1: Add font links inside `<head>` after `<meta charset>`**

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat(theme): load Bebas Neue and Inter fonts"
```

---

### Task 4: Theme infrastructure assembly test

**Files:**
- Create: `app/tests/styles/theme-tokens.test.ts`

- [ ] **Step 1: Write assembly test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const globalCss = readFileSync(
  resolve(appRoot, "src/styles/global.css"),
  "utf8",
);
const baseLayout = readFileSync(
  resolve(appRoot, "src/layouts/BaseLayout.astro"),
  "utf8",
);

describe("theme infrastructure", () => {
  it("uses shadcn hsl token hub in global.css", () => {
    expect(globalCss).toContain('--color-background: hsl(var(--background))');
    expect(globalCss).toContain("--background: 220 44% 13%");
    expect(globalCss).toContain("--primary: 346 90% 57%");
    expect(globalCss).toContain("--gradient-primary:");
    expect(globalCss).not.toContain("surface-page");
    expect(globalCss).not.toContain("prefers-color-scheme");
    expect(globalCss).not.toContain("data-theme");
  });

  it("registers tailwindcss-animate plugin", () => {
    expect(globalCss).toContain('@plugin "tailwindcss-animate"');
  });

  it("defines display and sans font tokens", () => {
    expect(globalCss).toContain('--font-display: "Bebas Neue"');
    expect(globalCss).toContain('--font-sans: "Inter"');
  });

  it("loads Google Fonts in BaseLayout", () => {
    expect(baseLayout).toContain("fonts.googleapis.com");
    expect(baseLayout).toContain("Bebas+Neue");
    expect(baseLayout).toContain("Inter");
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd app && npm test -- tests/styles/theme-tokens.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/styles/theme-tokens.test.ts
git commit -m "test(theme): assert shadcn token hub and font wiring"
```

---

### Task 5: Bulk-rename legacy token classes

**Files:**
- Modify: all `app/src/**/*.astro` files listed in spec §7 (47 files)
- Modify: `app/src/components/layout/NavBtn.astro` (manual: `text-accent` → `text-primary`)

- [ ] **Step 1: Run bulk replace on `src/` (order matters — longer patterns first)**

```bash
cd app
find src -name '*.astro' -print0 | xargs -0 sed -i '' \
  -e 's/text-accent-foreground/text-primary-foreground/g' \
  -e 's/bg-accent-hover/hover:brightness-110/g' \
  -e 's/hover:bg-accent-hover/hover:brightness-110/g' \
  -e 's/bg-surface-elevated/bg-popover/g' \
  -e 's/bg-surface-page/bg-background/g' \
  -e 's/bg-surface-card/bg-card/g' \
  -e 's/bg-surface-input/bg-muted/g' \
  -e 's/text-text-primary/text-foreground/g' \
  -e 's/text-text-muted/text-muted-foreground/g' \
  -e 's/hover:text-text-primary/hover:text-foreground/g' \
  -e 's/bg-accent/bg-primary/g' \
  -e 's/text-accent/text-primary/g' \
  -e 's/border-accent/border-primary/g' \
  -e 's/ring-accent/ring-primary/g' \
  -e 's/text-error/text-destructive/g'
```

- [ ] **Step 2: Fix NavBtn active state** (`app/src/components/layout/NavBtn.astro`)

Change line 14 from `text-accent` to `text-primary` (if sed missed due to exact match on composite string, verify):

```ts
  ? `${baseClassName} text-primary`
```

- [ ] **Step 3: Verify no legacy tokens remain**

```bash
cd app && rg 'surface-page|surface-card|surface-input|surface-elevated|text-text-primary|text-text-muted|bg-accent|accent-hover|text-error|text-accent' src/
```

Expected: no matches (except none should exist)

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "refactor(theme): rename legacy token classes to shadcn utilities"
```

---

### Task 6: Replace hardcoded slate utilities

**Files:**
- Modify: `app/src/components/ui/NumberInputPad.astro`
- Modify: `app/src/components/games/singles-training/DartInput.astro`
- Modify: `app/src/components/games/singles-training/ScorePanel.astro`
- Modify: `app/src/components/games/PlayerAvatar.astro`

- [ ] **Step 1: NumberInputPad.astro** — submit button (line ~35)

Replace:

```html
class="bg-primary rounded-md px-4 py-2 text-slate-900 text-xs"
```

With:

```html
class="rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground"
```

- [ ] **Step 2: DartInput.astro** — dart row container

Replace:

```html
class="bg-slate-500/20 rounded-md p-3 flex justify-between items-center divide-x divide-slate-500/20"
```

With:

```html
class="flex items-center justify-between divide-x divide-border rounded-md bg-muted/50 p-3"
```

Apply same `divide-border` and `bg-muted/50` to inner `divide-x` siblings in that file if present.

- [ ] **Step 3: ScorePanel.astro** — score label chip

Replace:

```html
class="text-xs text-muted-foreground font-mono uppercase tracking-wider bg-slate-600/20 rounded-md px-2 py-1"
```

With:

```html
class="rounded-md bg-muted/60 px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground"
```

- [ ] **Step 4: PlayerAvatar.astro** — name badge

Replace `text-slate-200` with `text-foreground` on the absolute name badge `span`.

- [ ] **Step 5: Verify no slate in src**

```bash
cd app && rg 'slate-' src/
```

Expected: no matches

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/NumberInputPad.astro \
  src/components/games/singles-training/DartInput.astro \
  src/components/games/singles-training/ScorePanel.astro \
  src/components/games/PlayerAvatar.astro
git commit -m "refactor(theme): replace hardcoded slate utilities with semantic tokens"
```

---

### Task 7: Typography pass — display headings

**Files:**
- Modify: `app/src/pages/index.astro`
- Modify: `app/src/components/games/GamePlayShell.astro`
- Modify: `app/src/components/games/501/SinglePlayerSummary.astro`

Apply spec §4.3 type scale to key headings only (not every label).

- [ ] **Step 1: index.astro** — Statistics section header

Replace:

```html
<h2 class="text-muted-foreground shrink-0 text-2xl font-semibold">
```

With:

```html
<h2 class="font-display shrink-0 text-2xl uppercase tracking-wide text-muted-foreground">
```

- [ ] **Step 2: GamePlayShell.astro** — game title

Replace:

```html
<h1 class="text-foreground text-2xl font-semibold">{game.displayName}</h1>
```

With:

```html
<h1 class="font-display text-3xl uppercase tracking-wide text-foreground">{game.displayName}</h1>
```

- [ ] **Step 3: SinglePlayerSummary.astro** — winner label

Replace:

```html
<h3 class="text-lg font-semibold uppercase text-muted-foreground">Winner!</h3>
```

With:

```html
<h3 class="font-display text-2xl uppercase tracking-wide text-muted-foreground">Winner!</h3>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/components/games/GamePlayShell.astro src/components/games/501/SinglePlayerSummary.astro
git commit -m "feat(theme): apply display typography to key headings"
```

---

### Task 8: Extend assembly test for migration completeness

**Files:**
- Modify: `app/tests/styles/theme-tokens.test.ts`

- [ ] **Step 1: Add legacy-token grep guard**

Append to the test file:

```ts
import { execSync } from "node:child_process";

// …existing imports and tests…

describe("theme migration completeness", () => {
  it("has no legacy token class names in src", () => {
    const result = execSync(
      `rg -l 'surface-page|surface-card|surface-input|surface-elevated|text-text-primary|text-text-muted|bg-accent|accent-hover|text-error|text-accent|slate-' src/ || true`,
      { cwd: appRoot, encoding: "utf8" },
    ).trim();
    expect(result).toBe("");
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd app && npm test -- tests/styles/theme-tokens.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/styles/theme-tokens.test.ts
git commit -m "test(theme): guard against legacy token class names"
```

---

### Task 9: Verification gate

- [ ] **Step 1: Static checks**

```bash
cd app && npm run check && npm test && npx fallow && npm run lint && ./scripts/audit-imports.sh
```

Expected: all pass

- [ ] **Step 2: Build**

```bash
cd app && npm run build
```

Expected: success

- [ ] **Step 3: Manual visual smoke**

With `npm run dev` running, verify:

| Route | Check |
| ----- | ----- |
| `/` | `bg-background` mirage-950 canvas; Bebas "Statistics" heading |
| `/login` | Gradient `.btn-primary`; input focus ring radical red |
| `/games/settings-501` | Cards `bg-card`; `RadioCard` checked state `border-primary bg-primary/10` |
| Any play page | Bottom nav active icon `text-primary` |

- [ ] **Step 4: Commit any fixups from verification**

```bash
git add -A
git commit -m "fix(theme): address verification gate findings"
```

(Skip commit if no fixups needed.)

---

## Spec Coverage Checklist

| Spec section | Task |
| ------------ | ---- |
| §3.1 shadcn `global.css` structure | Task 2 |
| §3.2 palette HSL values | Task 2 |
| §3.3 legacy → shadcn mapping | Task 5 |
| §4 typography + fonts | Tasks 3, 7 |
| §5 component classes | Task 2 |
| §6 motion (Emil) | Task 2 (retained) |
| §7 migration inventory | Tasks 5, 6 |
| §8 tailwindcss-animate | Task 1 |
| §9 verification | Task 9 |
| §10 out of scope | Not implemented |

## Palette Tuning Note

After implementation, edit HSL values in `:root` inside `global.css` only — refresh browser to experiment. No component changes required for color tweaks.
