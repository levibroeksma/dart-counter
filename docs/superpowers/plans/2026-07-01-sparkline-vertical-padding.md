# Sparkline Vertical Padding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~12px top/bottom inset to profile metric sparklines via Chart.js `layout.padding` so line and fill do not touch the card edges; horizontal stays edge-to-edge.

**Architecture:** Single change in `createSparkline()` — a module constant drives `options.layout.padding`. Canvas sizing, card CSS, scrim, and mount lifecycle are unchanged. All sparkline consumers inherit the fix automatically.

**Tech Stack:** Chart.js 4, Vitest + jsdom

**Spec:** `docs/superpowers/specs/2026-07-01-sparkline-vertical-padding-design.md`  
**Working directory:** `app/`

---

## File Structure Overview

| File | Responsibility |
| ---- | -------------- |
| `src/lib/client/charts/sparkline.ts` | Chart.js sparkline factory — add `SPARKLINE_VERTICAL_PADDING` + `layout.padding` |
| `tests/lib/client/charts/sparkline.test.ts` | Unit test asserting padding in chart config |

**Unchanged (out of scope):** `ProfileMetricCard.astro`, `global.css`, `mount-metric-charts.ts`, `profile-dashboard.ts`, API routes.

---

### Task 1: Sparkline vertical padding

**Files:**
- Modify: `app/src/lib/client/charts/sparkline.ts`
- Test: `app/tests/lib/client/charts/sparkline.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe("sparkline chart utils", ...)` block in `app/tests/lib/client/charts/sparkline.test.ts`, after the existing `"creates sparkline even with empty points"` test:

```ts
  it("applies 12px top and bottom layout padding", () => {
    const canvas = document.createElement("canvas");
    createSparkline(canvas, [{ x: "2026-01-01", y: 50 }], "chart-1");

    expect(chartFactory).toHaveBeenCalledTimes(1);
    const [, config] = chartFactory.mock.calls[0] as [
      HTMLCanvasElement,
      { options: { layout: { padding: { top: number; bottom: number } } } },
    ];
    expect(config.options.layout.padding).toEqual({ top: 12, bottom: 12 });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/client/charts/sparkline.test.ts`

Expected: FAIL — `config.options.layout` is `undefined`

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/client/charts/sparkline.ts`, add the constant after `Chart.register(...)`:

```ts
const SPARKLINE_VERTICAL_PADDING = 12;
```

Add `layout` to the `options` object inside `createSparkline()`:

```ts
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: {
          top: SPARKLINE_VERTICAL_PADDING,
          bottom: SPARKLINE_VERTICAL_PADDING,
        },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/client/charts/sparkline.test.ts`

Expected: PASS — all tests in file green

- [ ] **Step 5: Commit**

```bash
cd app
git add src/lib/client/charts/sparkline.ts tests/lib/client/charts/sparkline.test.ts
git commit -m "fix(charts): add vertical padding to profile sparklines"
```

---

### Task 2: Verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run full static checks**

Run:

```bash
cd app && npm test && npm run check && npm run lint
```

Expected: all pass with no errors

- [ ] **Step 2: Manual visual check (optional but recommended)**

1. Start dev server: `cd app && npm run dev`
2. Log in (seed user: `test@example.com` / `testpass`)
3. Open homepage metric cards with sparkline data (≥2 completions per metric)
4. Confirm ~12px gap between line/fill and card top/bottom; horizontal still full-bleed

No curl smoke required — no API, routing, or SSR changes per spec.

---

## Self-Review

| Spec requirement | Task |
| ---------------- | ---- |
| ~12px top/bottom inset | Task 1 — `SPARKLINE_VERTICAL_PADDING = 12` |
| Horizontal edge-to-edge | Task 1 — no left/right padding in `layout.padding` |
| Line + fill both inset | Task 1 — Chart.js `layout.padding` affects drawing area |
| No card CSS changes | Out of scope — no tasks touch CSS/components |
| Unit test for padding | Task 1 Step 1 |
| `npm test && check && lint` | Task 2 |

No placeholders. Single focused task + verification gate.
