# Theme Rebrand — Design Spec

> Input for `writing-plans` skill. Apply `frontend-design` and `emil-design-eng` during implementation.

**Date:** 2026-06-30  
**Scope:** Replace custom Tailwind v4 tokens with shadcn-style HSL infrastructure; rebrand to always-dark mirage surfaces + radical-red accents; full component class migration; pub/venue typography.

**Palette source:** `design-utils/UI-colors.md`

---

## 1. Overview

Dart Counter currently uses bespoke semantic tokens (`surface-page`, `text-text-primary`, `accent`) backed by slate/sky palettes with `prefers-color-scheme` and `data-theme` overrides.

This rebrand adopts the shadcn Tailwind v4 skeleton as the token hub so palette tuning happens in one `:root` block. The visual identity shifts to an always-dark pub/venue aesthetic: mirage blues for easy-on-the-eyes surfaces, radical red for primary actions, accents, and gradients.

| Item | Value |
| ---- | ----- |
| Theme mode | Always dark — `:root` values are the dark palette |
| Surface family | Mirage 900 / 950 (`#2a487e`, `#131d31`) |
| Accent family | Radical Red 500–700 (`#f42d5b` → `#bf1146`) |
| Token system | shadcn HSL vars → `@theme` color utilities |
| Typography | Bebas Neue (display) + Inter (body) + mono for scores |
| Migration | Full rename of legacy token classes (~47 files) |
| Approach | Pure shadcn `:root` HSL hub (no dual scale layer) |

---

## 2. Decisions log (brainstorming)

| Topic | Decision |
| ----- | -------- |
| Goal | Hybrid — shadcn infrastructure + visual rebrand |
| Semantic mapping | Mirage = surfaces; Radical Red = primary / accents / gradients |
| Light theme | Dark-only; no `.dark` class, no `prefers-color-scheme` blocks |
| Theme enforcement | `:root` = dark palette; no `data-theme` switching |
| Typography | Pub/venue — Bebas Neue / Oswald-style display + neutral sans body |
| Migration scope | Full rename — remove all legacy token names in one pass |
| Infrastructure approach | Pure shadcn `:root` HSL (recommended) |
| Sidebar / chart tokens | Define stubs in `:root` for future use; no UI consumption yet |
| Motion | Keep existing Emil-aligned patterns (`btn-press`, hover gates, reduced-motion) |

---

## 3. Token architecture

### 3.1 `global.css` structure

```text
@import 'tailwindcss'
@plugin 'tailwindcss-animate'

@theme {
  --color-background: hsl(var(--background))
  --color-foreground: hsl(var(--foreground))
  --color-card: hsl(var(--card))
  … (full shadcn semantic map)
  --radius-lg / md / sm
  --font-display: 'Bebas Neue', …
  --font-sans: 'Inter', system-ui, sans-serif
  --ease-out / --ease-in-out  (retain existing curves)
}

@layer base {
  :root { /* dark palette HSL values */ }
  body { @apply bg-background text-foreground font-sans }
}
```

**Remove:**

- `@theme inline` legacy semantic map (`surface-*`, `text-*`)
- Slate/sky runtime palette
- `@media (prefers-color-scheme: dark)` block
- `:root[data-theme="light"]` / `:root[data-theme="dark"]` blocks
- `@custom-variant dark` (not needed — no `.dark` class)

**Add:**

- `tailwindcss-animate` dev dependency
- shadcn border-color compatibility block (from skeleton)
- `--gradient-primary` CSS custom property

### 3.2 Palette → semantic mapping

HSL values computed from `design-utils/UI-colors.md` hex sources.

| Token | HSL | Hex source | Role |
| ----- | --- | ---------- | ---- |
| `--background` | `220 44% 13%` | mirage-950 | Page canvas |
| `--foreground` | `210 75% 97%` | mirage-50 | Primary text |
| `--card` | `219 50% 33%` | mirage-900 | Cards, panels |
| `--card-foreground` | `209 73% 93%` | mirage-100 | Text on cards |
| `--popover` | `219 50% 33%` | mirage-900 | Elevated surfaces (toasts, menus) |
| `--popover-foreground` | `209 73% 93%` | mirage-100 | Text on popovers |
| `--primary` | `346 90% 57%` | radical-red-500 | Primary buttons, active nav |
| `--primary-foreground` | `0 0% 100%` | white | Text on primary |
| `--secondary` | `220 55% 40%` | mirage-800 | Secondary surfaces |
| `--secondary-foreground` | `210 75% 97%` | mirage-50 | Text on secondary |
| `--muted` | `219 50% 33%` | mirage-900 | Input backgrounds, skeletons |
| `--muted-foreground` | `207 73% 68%` | mirage-400 | Muted labels, section headers |
| `--accent` | `220 55% 40%` | mirage-800 | Subtle hover backgrounds (not red) |
| `--accent-foreground` | `210 75% 97%` | mirage-50 | Text on accent surfaces |
| `--destructive` | `342 84% 41%` | radical-red-700 | Errors |
| `--destructive-foreground` | `0 0% 100%` | white | Text on destructive |
| `--border` | `220 55% 40%` | mirage-800 | Borders |
| `--input` | `220 55% 40%` | mirage-800 | Input borders |
| `--ring` | `346 90% 57%` | radical-red-500 | Focus rings |
| `--radius` | `0.5rem` | shadcn default | Base radius |

**Gradients & shadows:**

```css
--gradient-primary: linear-gradient(
  135deg,
  hsl(343 78% 50%) 0%,
  hsl(346 90% 57%) 100%
);
--shadow-card: 0 1px 3px hsl(220 44% 5% / 0.4);
--shadow-menu: 0 4px 16px hsl(220 44% 5% / 0.5);
```

Expose shadows via `@theme` if component classes reference `shadow-card` / `shadow-menu`.

**Chart / sidebar stubs** (shadcn defaults adjusted to palette — tune in `:root` only):

```css
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
```

### 3.3 Legacy → shadcn class mapping

Mechanical rename across all consumers. No alias bridge.

| Legacy class | New class |
| ------------ | --------- |
| `bg-surface-page` | `bg-background` |
| `bg-surface-card` | `bg-card` |
| `bg-surface-input` | `bg-muted` |
| `bg-surface-elevated` | `bg-popover` |
| `text-text-primary` | `text-foreground` |
| `text-text-muted` | `text-muted-foreground` |
| `bg-accent` | `bg-primary` |
| `bg-accent-hover` / `hover:bg-accent-hover` | `hover:brightness-110` on primary |
| `text-accent-foreground` | `text-primary-foreground` |
| `text-accent` / `hover:text-accent` | `text-primary` / `hover:text-primary` |
| `text-error` | `text-destructive` |
| `border-accent` | `border-primary` |
| `text-slate-*` (4 files) | Nearest semantic token |

---

## 4. Typography

### 4.1 Font loading

Add to `BaseLayout.astro` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

### 4.2 `@theme` font tokens

```css
@theme {
  --font-display: 'Bebas Neue', ui-sans-serif, system-ui, sans-serif;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
```

### 4.3 Type scale

| Element | Classes |
| ------- | ------- |
| Game / page title | `font-display text-3xl tracking-wide uppercase` |
| Section header | `font-display text-2xl tracking-wide uppercase text-muted-foreground` |
| Stat value | `font-mono text-xl font-bold text-foreground` |
| Stat label | `text-xs uppercase tracking-wider text-muted-foreground` |
| Body copy | `text-sm text-foreground` |

Update `.section-label` component class to use `font-display`.

---

## 5. Component classes (`@layer components`)

Retain motion patterns; retokenize colors.

| Class | Updated definition |
| ----- | ------------------ |
| `.btn-press` | Unchanged — `scale(0.97)` on `:active`, 160ms `--ease-out` |
| `.btn-primary` | `rounded-full bg-[var(--gradient-primary)] text-primary-foreground font-medium px-4 py-2.5`; hover `brightness-110` behind `(hover: hover)` gate |
| `.btn-secondary` | `rounded-full border border-border bg-card text-foreground px-4 py-2 text-sm` |
| `.card` | `rounded-xl border border-border bg-card shadow-card` |
| `.card-interactive` | Same surfaces; keep transform/color transitions |
| `.game-panel` | `rounded-lg border border-border bg-card shadow-card` |
| `.input-field` | `bg-muted border-input text-foreground`; focus `border-primary` + `box-shadow: 0 0 0 3px hsl(var(--ring) / 0.4)` |
| `.link-subtle` | `text-muted-foreground text-sm`; hover `text-foreground` |
| `.nav-link-inactive` | `text-muted-foreground`; hover `text-primary` |
| `.section-label` | `font-display uppercase tracking-wider text-muted-foreground text-sm` |
| `.skeleton` | `bg-muted animate-pulse` (replace `bg-white/10`) |
| `.spinner` | `border-primary border-t-transparent` |
| `.checkout-hint` | `bg-muted font-mono text-sm` |
| `.icon-btn-hover:hover` | `text-primary bg-muted` |
| `.game-card-link:hover` | `text-primary` |

**Toast / menu panels:** keep `transform-origin` rules; update surface tokens to `bg-popover`.

---

## 6. Motion (emil-design-eng)

| Rule | Implementation |
| ---- | -------------- |
| Button press feedback | `.btn-press:active { transform: scale(0.97) }` — 160ms |
| No `transition: all` | Specify `transform`, `background-color`, `opacity` only |
| Hover gated | `@media (hover: hover) and (pointer: fine)` — already present |
| Primary hover | `brightness-110` not scale — scale reserved for press |
| Reduced motion | Existing `@media (prefers-reduced-motion: reduce)` block — retain |
| Toast enter/exit | Keep `transition-fade-scale-*`; use `--ease-out`, ≤200ms enter / 150ms exit |
| No keyboard-action animation | Score input / numpad — no added motion |

---

## 7. Migration inventory

Files requiring token class updates (grep-confirmed):

- `src/styles/global.css`
- `src/pages/index.astro`
- `src/components/layout/AppHeader.astro`, `BottomNav.astro`
- `src/components/ui/` — `Input`, `NumberInputPad`, `RadioCard`, `ConfirmationModal`
- `src/components/forms/LoginForm.astro`
- `src/components/auth/UserMenu.astro`, `LogoutBtn.astro`
- `src/components/settings/DisplayNameSetting.astro`
- `src/components/games/` — all game shells, cards, summaries, modals (~30 files)

**Hardcoded slate cleanup** (replace with semantic tokens):

- `NumberInputPad.astro`
- `DartInput.astro`
- `PlayerAvatar.astro`
- `ScorePanel.astro`

---

## 8. Dependencies

```bash
cd app && npm install -D tailwindcss-animate
```

---

## 9. Verification

```bash
cd app
npm run check
npm test
npm run lint
npx fallow
./scripts/audit-imports.sh
```

**Manual smoke** (dev server running):

- Home (`/`) — mirage-950 background, display headings, mono stats
- Login (`/login`) — primary gradient button, input focus ring
- Game settings + play (501 or TUOD) — cards, nav, toasts, modals
- Confirm no flash of wrong theme (always dark)
- `prefers-reduced-motion` — no scale on press

---

## 10. Out of scope

- Light theme palette
- Theme toggle / `data-theme` settings UI
- Sidebar component consumption
- Chart color usage
- Visual redesign of layout structure (token + typography swap only)
- New UI components

---

## 11. Implementation notes for `writing-plans`

Suggested task order:

1. Add `tailwindcss-animate`; restructure `global.css`
2. Add font links to `BaseLayout.astro`
3. Bulk-rename token classes (layouts → ui → games → pages)
4. Update component classes in `global.css`
5. Fix remaining hardcoded `slate-*` utilities
6. Run verification + visual smoke

**Tuning workflow:** Edit HSL values in `:root` only → refresh browser. No component changes needed for palette experiments.
