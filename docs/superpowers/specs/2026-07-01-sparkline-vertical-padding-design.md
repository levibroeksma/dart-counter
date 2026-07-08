# Sparkline Vertical Padding — Design Spec

> Amends sparkline rendering in `2026-06-30-profile-charts-client-design.md`. Input for `writing-plans` skill.

**Date:** 2026-07-01
**Scope:** Add ~12px top/bottom inset to profile metric sparklines so line and fill do not touch the card edges. Horizontal remains edge-to-edge.

---

## 1. Problem

Homepage metric card sparklines render flush to the top and bottom of the card container:

| Symptom | Root cause |
| ------- | ---------- |
| Line/fill touch card top and bottom borders | Canvas is `h-full w-full`; Chart.js has no layout padding |
| Visually cramped | No breathing room between chart data area and card chrome |

Left-to-right edge-to-edge is intentional and unchanged.

---

## 2. Decision

**Approach A — Chart.js `layout.padding`** (approved).

| Approach | Verdict |
| -------- | ------- |
| Chart.js `layout.padding` | **Chosen** — line and fill both inset; no card CSS changes |
| CSS `py-3` on canvas | Rejected — scrim stays full-bleed; grid/scrim mismatch |
| Padded canvas wrapper | Rejected — extra DOM; same outcome with more churn |

### Requirements (approved)

| Requirement | Value |
| ----------- | ----- |
| Vertical inset | ~12px top and bottom (matches card content `p-3`) |
| Horizontal | Edge-to-edge (no left/right padding) |
| Fill behavior | Fill gradient respects same inset as line |
| Scrim / card CSS | Unchanged |

---

## 3. Implementation

### File: `app/src/lib/client/charts/sparkline.ts`

Add a module-level constant:

```ts
const SPARKLINE_VERTICAL_PADDING = 12;
```

Add to Chart.js `options`:

```ts
layout: {
  padding: {
    top: SPARKLINE_VERTICAL_PADDING,
    bottom: SPARKLINE_VERTICAL_PADDING,
  },
},
```

Canvas sizing, mount lifecycle, and card markup stay unchanged. All consumers of `createSparkline()` (homepage metric cards, future `/statistics` dashboard) inherit the fix.

### Out of scope

- `ProfileMetricCard.astro` layout changes
- `.card-metric-liquid*` CSS changes
- Scrim gradient adjustments
- Y-axis scale / grace tuning
- API or Alpine factory changes

---

## 4. Testing

### Unit — `tests/lib/client/charts/sparkline.test.ts`

Assert created chart config includes:

```ts
expect(config.options.layout.padding).toEqual({ top: 12, bottom: 12 });
```

Existing `mount-metric-charts` and `profile-dashboard` tests unchanged (mock `createSparkline`).

### Manual

1. `npm run dev` with seeded stat completions
2. Load homepage metric cards
3. Confirm ~12px gap between line/fill and card top/bottom borders; horizontal still full-bleed

---

## 5. Verification

```bash
cd app && npm test && npm run check && npm run lint
```

No curl smoke — no API, routing, or SSR changes.
