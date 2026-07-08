# Profile Charts — Client-Side Design Spec

> Supersedes §7.5 (Chart.js client wiring) and §7.1 (homepage SSR) in `2026-06-30-player-statistics-design.md` for data loading and chart lifecycle. Input for `writing-plans` skill.

**Date:** 2026-06-30
**Scope:** Fix Chart.js sparkline rendering; move homepage stats to static shell + client fetch; reusable chart mount layer for future `/statistics` page.

---

## 1. Problem

Current homepage stats implementation is broken:

| Symptom                    | Root cause                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Sparklines never render    | Chart.js mounts before canvas has layout dimensions                                            |
| Charts init too early      | No `isLoading` / `x-show` lifecycle — `requestAnimationFrame` in `init()` races DOM visibility |
| Zero-height canvas in grid | Missing `min-h-0` on canvas (required for grid/flex children)                                  |
| Wrong architecture         | SSR embeds `data-sparklines` JSON; page should be static with Alpine-owned fetch and bindings  |

---

## 2. Decision

**Approach B — layered dashboard factory + chart helpers** (approved).

| Layer                                      | Responsibility                                                 |
| ------------------------------------------ | -------------------------------------------------------------- |
| Static Astro shell                         | Skeleton markup only; no server data fetch                     |
| `GET /api/profile/dashboard`               | Auth-gated JSON for metrics, sparklines, counters, displayName |
| `profileDashboard()` Alpine factory        | Fetch, `isLoading`, state bindings, chart lifecycle            |
| `mountMetricCharts()`                      | DOM scan + Chart.js create/destroy (shared)                    |
| `createSparkline()` / `destroySparkline()` | Pure Chart.js helpers (existing)                               |

Per-card `metricChart()` sub-factories deferred — not needed for 3 homepage cards.

---

## 3. Architecture

```text
index.astro (prerender = true)
  └── ProfileStatsSection.astro
        x-data="profileDashboard()"
        ├── skeleton (x-show="isLoading" x-cloak)
        └── content  (x-show="!isLoading" x-cloak)
              ├── nickname, games played/won (x-text bindings)
              └── ProfileMetricCard × 3 (Alpine-driven showChart + values)
                    └── canvas.min-h-0 (Chart.js target)

init() flow:
  isLoading=true → fetch /api/profile/dashboard
  → bind state → isLoading=false
  → $nextTick → requestAnimationFrame → mountMetricCharts($el, sparklines)
  → ready=true

destroy() → destroySparkline() for each chart
```

Auth unchanged: middleware redirects unauthenticated users before static page is served.

---

## 4. API

### `GET /api/profile/dashboard`

**File:** `app/src/pages/api/profile/dashboard.ts`

**Auth:** `getSession` → 401 if not logged in.

**Response** (`ProfileDashboardSuccess` in `lib/shared/api/types.ts`):

```ts
{
  ok: true;
  displayName?: string;
  metrics: ProfileMetrics;
  sparklines: SparklineSeries[];
  gamesPlayed: number;
  gamesWon: number;
}
```

**Server:** `getProfileDashboardData(userId)` + `getPreferences(userId)` for displayName — single round-trip for homepage.

**Errors:** `{ ok: false, code: MessageCode.* }` — 401 unauthorized, 500 server error.

---

## 5. Alpine factory

### `profileDashboard()` — `app/src/lib/client/alpine/profile-dashboard.ts`

Replaces `homeStats`. Registered in `app.factory.ts` as `Alpine.data('profileDashboard', profileDashboard)`.

**State:**

| Field         | Initial     | Notes                               |
| ------------- | ----------- | ----------------------------------- |
| `isLoading`   | `true`      | Drives skeleton `x-show`            |
| `ready`       | `false`     | Charts mounted                      |
| `error`       | `''`        | Fetch failure message code or empty |
| `displayName` | `'You'`     | From API                            |
| `gamesPlayed` | `0`         |                                     |
| `gamesWon`    | `0`         |                                     |
| `metrics`     | empty nulls | `ProfileMetrics` shape              |
| `sparklines`  | `[]`        | `SparklineSeries[]`                 |

**Computed helpers** (methods, not stored formatted strings):

- `formattedThreeDartAverage()` → `formatThreeDartAverage(metrics.threeDartAverage)`
- `formattedScoringAverage()` → `formatScoringAverage(metrics.scoringAverage)`
- `formattedCheckoutPercentage()` → `formatCheckoutPercentage(metrics.checkoutPercentage)`
- `showChart(kind)` → sparkline for kind has `points.length >= 2`

Formatting uses `@lib/shared/stats` format helpers (same as current SSR).

`init()`**:**

1. `fetch('/api/profile/dashboard')`
2. Parse `ApiResponse`; on error set `error`, `isLoading = false`, leave defaults
3. On success bind all fields
4. `isLoading = false`
5. `this.$nextTick(() => requestAnimationFrame(() => { mountMetricCharts(this.$el, this.sparklines); this.ready = true; }))`

`destroy()`**:** call `destroyMetricCharts(charts)` and `unbindChartResize()` — charts stored in closure `Map<string, Chart>`.

**Resize on viewport change:** after charts mount, call `bindChartResize(root, charts)` which returns a teardown function. Uses `ResizeObserver` on the section root plus `window` `resize` listener (covers orientation flip). Both debounced via `requestAnimationFrame`; each tick calls `chart.resize()` on every mounted chart. Teardown in `destroy()`.

---

## 6. Chart mount helper

### `mountMetricCharts()` — `app/src/lib/client/charts/mount-metric-charts.ts`

Extracted from current `home-stats.ts` logic.

```ts
export function mountMetricCharts(
  root: HTMLElement,
  series: SparklineSeries[],
  charts: Map<string, Chart>,
): void;

export function destroyMetricCharts(charts: Map<string, Chart>): void;

export function bindChartResize(
  root: HTMLElement,
  charts: Map<string, Chart>,
): () => void;
```

**Scan:** `root.querySelectorAll('[data-metric-kind]')`

**Per card:** read `data-metric-kind`, `data-chart-token`, find matching series, skip if `< 2` points or no canvas.

**After create:** `chart.resize()` to force layout measurement.

**Resize:** `bindChartResize` observes `root` + listens to `window.resize`; calls `chart.resize()` on all charts in the map. Returns `unbind` for `destroy()`.

**No** `data-sparklines` **on section** — series passed from Alpine state.

---

## 7. UI components

### `index.astro`

No server data fetch in frontmatter. Render static `ProfileStatsSection` only.

Note: do **not** use `prerender = true` on auth-protected routes — middleware session checks are skipped for prerendered pages.

### `ProfileStatsSection.astro`

- No `Props` with dashboard data
- Root: `x-data="profileDashboard()"`
- Remove `data-sparklines`
- Skeleton region: mirrors layout (nickname, 2 stat cells, 3 metric card skeletons) using `Skeleton.astro`
- Content region: `x-show="!isLoading" x-cloak` with `x-text` bindings
- Metric cards: static three-card layout with `data-metric-kind` / `data-chart-token`; canvas `x-show="showChart('threeDartAverage')"` etc.

### `ProfileMetricCard.astro`

Two modes:

| Mode            | Use                                                                             |
| --------------- | ------------------------------------------------------------------------------- |
| Static skeleton | Astro-only, no Alpine — used in loading shell                                   |
| Alpine-driven   | Receives bindings via parent template or inline markup in `ProfileStatsSection` |

Prefer keeping card markup in `ProfileStatsSection` with Alpine directives rather than Astro props for values — cards are always client-bound.

**Canvas class:** `card-metric-liquid-canvas min-h-0`

### `global.css`

Card container keeps `min-h-28`. Canvas gets `min-h-0` only (grid child shrink fix):

```css
.card-metric-liquid-canvas {
  @apply pointer-events-none min-h-0 h-full w-full;
}
```

---

## 8. Chart.js options (unchanged)

From existing `sparkline.ts`:

- `responsive: true`, `maintainAspectRatio: false`
- `animation: false`
- No legend, no tooltip
- Hidden axes
- Area fill gradient from `--chart-N` token

---

## 9. Empty / error states

| State                  | UI                                                                                |
| ---------------------- | --------------------------------------------------------------------------------- |
| Loading                | Skeleton visible (`isLoading`)                                                    |
| Fetch error            | Content visible; metrics show `—`; no charts; optional toast later (out of scope) |
| No completions         | `gamesPlayed: 0`, metrics `—`, charts hidden                                      |
| `< 2` sparkline points | Hide canvas for that metric (`showChart` false)                                   |

---

## 10. Future `/statistics` reuse

| Piece   | Homepage now                            | Statistics page later                                  |
| ------- | --------------------------------------- | ------------------------------------------------------ | --- | ---- |
| API     | `GET /api/profile/dashboard`            | Extend with `?range=1m                                 | 3m  | all` |
| Factory | `profileDashboard()`                    | `statsDashboard({ range })` — same fetch/mount pattern |
| Charts  | `mountMetricCharts` + `createSparkline` | Same helpers; add larger chart types alongside         |

---

## 11. Files

| Action | Path                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| Create | `app/src/pages/api/profile/dashboard.ts`                                          |
| Create | `app/src/lib/client/alpine/profile-dashboard.ts`                                  |
| Create | `app/src/lib/client/charts/mount-metric-charts.ts` (includes `bindChartResize`) |
| Create | `app/tests/api/profile/dashboard.test.ts`                                         |
| Create | `app/tests/lib/client/alpine/profile-dashboard.test.ts`                           |
| Create | `app/tests/lib/client/charts/mount-metric-charts.test.ts`                         |
| Modify | `app/src/pages/index.astro`                                                       |
| Modify | `app/src/components/stats/ProfileStatsSection.astro`                              |
| Modify | `app/src/components/stats/ProfileMetricCard.astro` (skeleton variant or simplify) |
| Modify | `app/src/styles/global.css`                                                       |
| Modify | `app/src/lib/shared/api/types.ts`                                                 |
| Modify | `app/src/lib/client/alpine/app.factory.ts`                                        |
| Modify | `app/tests/pages/home-stats-assembly.test.ts`                                     |
| Modify | `app/scripts/curl-verify-db.sh` (dashboard API smoke)                             |
| Modify | `AGENTS.md` (profile stats + Chart.js client pattern)                             |
| Delete | `app/src/lib/client/alpine/home-stats.ts`                                         |

---

## 12. Testing

| Layer               | Tests                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| API                 | Auth 401; logged-in returns shape; empty user returns zeros                                                                                  |
| `mountMetricCharts` | Skips `< 2` points; creates chart per card; destroy clears map; `bindChartResize` calls `resize` on viewport change |
| `profileDashboard`  | `isLoading` true initially; after mock fetch binds state; calls mount after tick                                                             |
| Assembly            | `index.astro` has `prerender`, no `getProfileDashboardData`; section has `profileDashboard()`, skeleton `x-show`/`x-cloak`, canvas `min-h-0` |
| Curl                | `curl-verify-db.sh` asserts `GET /api/profile/dashboard` 200 + `ok:true` when logged in                                                      |

---

## 13. Verification

```bash
cd app
npm run check
npm test
npm run lint
npx fallow
./scripts/audit-imports.sh
./scripts/curl-verify-db.sh
```

**Manual:** seed demo completions → load homepage → skeleton flashes → metrics + sparklines render.

---

## 14. Related docs

| Doc                                      | Relationship                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `2026-06-30-player-statistics-design.md` | Data layer, metric definitions, card visual design — still authoritative except §7.1 SSR and §7.5 wiring |
| `AGENTS.md`                              | Alpine `x-show` + `x-cloak` rule; client session patterns                                                |
