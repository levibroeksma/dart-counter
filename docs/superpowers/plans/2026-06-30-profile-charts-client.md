# Profile Charts Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix homepage Chart.js sparklines by moving to a static shell + Alpine `profileDashboard()` factory that fetches `/api/profile/dashboard`, shows skeletons until loaded, mounts charts after layout, and resizes on viewport change.

**Architecture:** Layered approach — API returns dashboard JSON; `profileDashboard()` owns fetch/`isLoading`/bindings; `mountMetricCharts()` + `bindChartResize()` own Chart.js lifecycle; `createSparkline()` stays a pure helper. Homepage `index.astro` is prerendered with no server data fetch.

**Tech Stack:** Astro 6 (prerender per-page), Alpine.js 3, Chart.js 4, Tailwind CSS 4, Vitest + jsdom

**Spec:** `docs/superpowers/specs/2026-06-30-profile-charts-client-design.md`  
**Working directory:** `app/`

---

## File Structure Overview

| File | Responsibility |
| ---- | -------------- |
| `src/pages/api/profile/dashboard.ts` | Auth-gated GET; merges dashboard + displayName |
| `src/lib/shared/api/types.ts` | `ProfileDashboardSuccess` response type |
| `src/lib/client/charts/mount-metric-charts.ts` | `mountMetricCharts`, `destroyMetricCharts`, `bindChartResize` |
| `src/lib/client/charts/sparkline.ts` | Pure Chart.js create/destroy (existing) |
| `src/lib/client/alpine/profile-dashboard.ts` | Alpine factory: fetch, skeleton state, chart lifecycle |
| `src/lib/client/alpine/app.factory.ts` | Register `profileDashboard`; remove `homeStats` |
| `src/pages/index.astro` | Static prerender shell only |
| `src/components/stats/ProfileStatsSection.astro` | Skeleton + Alpine-bound content |
| `src/components/stats/ProfileMetricCard.astro` | Skeleton variant + liquid card markup |
| `src/styles/global.css` | `min-h-0` on canvas |
| `AGENTS.md` | Anchor profile-stats + Chart.js client pattern |
| `scripts/curl-verify-db.sh` | Dashboard API smoke |
| `tests/api/profile/dashboard.test.ts` | API unit tests |
| `tests/lib/client/charts/mount-metric-charts.test.ts` | Mount + resize unit tests |
| `tests/lib/client/alpine/profile-dashboard.test.ts` | Factory unit tests |
| `tests/pages/home-stats-assembly.test.ts` | Static wiring assembly |

---

### Task 1: API response type

**Files:**
- Modify: `app/src/lib/shared/api/types.ts`
- Test: `app/tests/api/profile/dashboard.test.ts` (import only — full tests in Task 2)

- [ ] **Step 1: Add `ProfileDashboardSuccess` to shared API types**

Add imports at top of `app/src/lib/shared/api/types.ts`:

```ts
import type {
  ProfileMetrics,
  SparklineSeries,
} from "@lib/shared/stats";
```

Add type and extend union (after `PreferencesSuccess`):

```ts
export type ProfileDashboardSuccess = {
  ok: true;
  displayName?: string;
  metrics: ProfileMetrics;
  sparklines: SparklineSeries[];
  gamesPlayed: number;
  gamesWon: number;
};
```

Update `ApiSuccess` union to include `ProfileDashboardSuccess`.

- [ ] **Step 2: Run typecheck**

Run: `cd app && npm run check`  
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/api/types.ts
git commit -m "feat(api): add ProfileDashboardSuccess response type"
```

---

### Task 2: Dashboard API endpoint

**Files:**
- Create: `app/src/pages/api/profile/dashboard.ts`
- Create: `app/tests/api/profile/dashboard.test.ts`

- [ ] **Step 1: Write failing API tests**

Create `app/tests/api/profile/dashboard.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { GET } from "@api/profile/dashboard";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { TEST_USER_ID } from "@tests/helpers/constants";

const mockGetProfileDashboardData = vi.fn();
const mockGetPreferences = vi.fn();

vi.mock("@lib/server/data/player-stat-completions", () => ({
  getProfileDashboardData: (...args: unknown[]) =>
    mockGetProfileDashboardData(...args),
}));

vi.mock("@lib/server/data/preferences", () => ({
  getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
}));

const mockSession: { isLoggedIn: boolean; userId?: string } = {
  isLoggedIn: false,
};

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => mockSession),
}));

function createGetContext(): APIContext {
  return {
    request: new Request("http://localhost/api/profile/dashboard"),
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

const emptyDashboard = {
  metrics: {
    threeDartAverage: null,
    scoringAverage: null,
    checkoutPercentage: null,
  },
  sparklines: [],
  gamesPlayed: 0,
  gamesWon: 0,
};

describe("GET /api/profile/dashboard", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockSession.userId = undefined;
    mockGetProfileDashboardData.mockReset();
    mockGetPreferences.mockReset();
  });

  it("returns 401 when not logged in", async () => {
    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns dashboard data and displayName when logged in", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = TEST_USER_ID;
    mockGetProfileDashboardData.mockResolvedValue({
      ...emptyDashboard,
      gamesPlayed: 5,
      gamesWon: 2,
    });
    mockGetPreferences.mockResolvedValue({ displayName: "Alex" });

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      ok: true,
      displayName: "Alex",
      gamesPlayed: 5,
      gamesWon: 2,
      metrics: emptyDashboard.metrics,
      sparklines: [],
    });
    expect(mockGetProfileDashboardData).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mockGetPreferences).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("returns 500 when dashboard fetch fails", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = TEST_USER_ID;
    mockGetProfileDashboardData.mockRejectedValue(new Error("db down"));

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_ERROR });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/api/profile/dashboard.test.ts`  
Expected: FAIL — cannot find module `@api/profile/dashboard`

- [ ] **Step 3: Implement API route**

Create `app/src/pages/api/profile/dashboard.ts`:

```ts
import type { APIRoute } from "astro";
import type { ApiResponse, ProfileDashboardSuccess } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { getSession } from "@lib/server/auth/session";
import { getProfileDashboardData } from "@lib/server/data/player-stat-completions";
import { getPreferences } from "@lib/server/data/preferences";

function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session.isLoggedIn || !session.userId) {
    return jsonResponse({ ok: false, code: MessageCode.UNAUTHORIZED }, 401);
  }

  try {
    const [dashboard, prefs] = await Promise.all([
      getProfileDashboardData(session.userId),
      getPreferences(session.userId),
    ]);

    const body: ProfileDashboardSuccess = {
      ok: true,
      metrics: dashboard.metrics,
      sparklines: dashboard.sparklines,
      gamesPlayed: dashboard.gamesPlayed,
      gamesWon: dashboard.gamesWon,
    };
    if (prefs.displayName) {
      body.displayName = prefs.displayName;
    }
    return jsonResponse(body, 200);
  } catch {
    return jsonResponse({ ok: false, code: MessageCode.SERVER_ERROR }, 500);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/api/profile/dashboard.test.ts`  
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/profile/dashboard.ts tests/api/profile/dashboard.test.ts
git commit -m "feat(api): add GET /api/profile/dashboard"
```

---

### Task 3: Chart mount + resize helpers

**Files:**
- Create: `app/src/lib/client/charts/mount-metric-charts.ts`
- Create: `app/tests/lib/client/charts/mount-metric-charts.test.ts`

- [ ] **Step 1: Write failing mount + resize tests**

Create `app/tests/lib/client/charts/mount-metric-charts.test.ts`:

```ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SparklineSeries } from "@lib/shared/stats";

const createSparkline = vi.fn();
const destroySparkline = vi.fn();

vi.mock("@lib/client/charts/sparkline", () => ({
  createSparkline: (...args: unknown[]) => createSparkline(...args),
  destroySparkline: (...args: unknown[]) => destroySparkline(...args),
}));

import {
  mountMetricCharts,
  destroyMetricCharts,
  bindChartResize,
} from "@lib/client/charts/mount-metric-charts";

function makeSeries(): SparklineSeries[] {
  return [
    {
      kind: "threeDartAverage",
      points: [
        { x: "2026-01-01", y: 40 },
        { x: "2026-01-02", y: 42 },
      ],
    },
  ];
}

function makeRoot(): HTMLElement {
  const root = document.createElement("section");
  root.innerHTML = `
    <article class="card-metric-liquid" data-metric-kind="threeDartAverage" data-chart-token="chart-1" data-show-chart="true">
      <canvas class="card-metric-liquid-canvas"></canvas>
    </article>
    <article class="card-metric-liquid" data-metric-kind="scoringAverage" data-chart-token="chart-2" data-show-chart="true">
      <canvas class="card-metric-liquid-canvas"></canvas>
    </article>
  `;
  return root;
}

describe("mountMetricCharts", () => {
  beforeEach(() => {
    createSparkline.mockReset();
    destroySparkline.mockReset();
    createSparkline.mockImplementation(() => ({ resize: vi.fn() }));
  });

  it("creates chart only for series with at least two points", () => {
    const charts = new Map();
    mountMetricCharts(makeRoot(), makeSeries(), charts);

    expect(createSparkline).toHaveBeenCalledTimes(1);
    expect(charts.has("threeDartAverage")).toBe(true);
    expect(charts.has("scoringAverage")).toBe(false);
  });

  it("destroyMetricCharts destroys and clears all charts", () => {
    const chart = { resize: vi.fn() };
    const charts = new Map([["threeDartAverage", chart]]);
    destroyMetricCharts(charts);

    expect(destroySparkline).toHaveBeenCalledWith(chart);
    expect(charts.size).toBe(0);
  });
});

describe("bindChartResize", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls resize on all charts when window resizes", () => {
    const resize = vi.fn();
    const charts = new Map([["threeDartAverage", { resize }]]);
    const root = document.createElement("section");
    document.body.appendChild(root);

    const unbind = bindChartResize(root, charts);
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(resize).toHaveBeenCalled();
    unbind();
    document.body.removeChild(root);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/client/charts/mount-metric-charts.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement mount-metric-charts.ts**

Create `app/src/lib/client/charts/mount-metric-charts.ts`:

```ts
import type { Chart } from "chart.js";
import type { MetricKind, SparklineSeries } from "@lib/shared/stats";
import { createSparkline, destroySparkline } from "./sparkline";

export function mountMetricCharts(
  root: HTMLElement,
  series: SparklineSeries[],
  charts: Map<string, Chart>,
): void {
  const cards = root.querySelectorAll<HTMLElement>("[data-metric-kind]");
  for (const card of cards) {
    const kind = card.dataset.metricKind as MetricKind | undefined;
    const token = card.dataset.chartToken as
      | "chart-1"
      | "chart-2"
      | "chart-3"
      | undefined;
    const canvas = card.querySelector("canvas");
    const match = series.find((s) => s.kind === kind);

    if (!canvas || !kind || !token || !match || match.points.length < 2) {
      continue;
    }

    const chart = createSparkline(canvas, match.points, token);
    chart.resize();
    charts.set(kind, chart);
  }
}

export function destroyMetricCharts(charts: Map<string, Chart>): void {
  for (const chart of charts.values()) {
    destroySparkline(chart);
  }
  charts.clear();
}

/**
 * Observes layout changes and window resize; calls chart.resize() on each chart.
 * Returns teardown — call from Alpine destroy().
 */
export function bindChartResize(
  root: HTMLElement,
  charts: Map<string, Chart>,
): () => void {
  let frameId = 0;

  const resizeAll = () => {
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => {
      for (const chart of charts.values()) {
        chart.resize();
      }
    });
  };

  const observer =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(resizeAll)
      : null;
  observer?.observe(root);
  window.addEventListener("resize", resizeAll);

  return () => {
    cancelAnimationFrame(frameId);
    observer?.disconnect();
    window.removeEventListener("resize", resizeAll);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/client/charts/mount-metric-charts.test.ts`  
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/charts/mount-metric-charts.ts tests/lib/client/charts/mount-metric-charts.test.ts
git commit -m "feat(charts): add mount and resize helpers for metric sparklines"
```

---

### Task 4: profileDashboard Alpine factory

**Files:**
- Create: `app/src/lib/client/alpine/profile-dashboard.ts`
- Create: `app/tests/lib/client/alpine/profile-dashboard.test.ts`

- [ ] **Step 1: Write failing factory tests**

Create `app/tests/lib/client/alpine/profile-dashboard.test.ts`:

```ts
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { profileDashboard } from "@lib/client/alpine/profile-dashboard";

const mountMetricCharts = vi.fn();
const destroyMetricCharts = vi.fn();
const bindChartResize = vi.fn();

vi.mock("@lib/client/charts/mount-metric-charts", () => ({
  mountMetricCharts: (...args: unknown[]) => mountMetricCharts(...args),
  destroyMetricCharts: (...args: unknown[]) => destroyMetricCharts(...args),
  bindChartResize: (...args: unknown[]) => bindChartResize(...args),
}));

describe("profileDashboard", () => {
  beforeEach(() => {
    mountMetricCharts.mockReset();
    destroyMetricCharts.mockReset();
    bindChartResize.mockReset();
    bindChartResize.mockReturnValue(vi.fn());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          displayName: "Alex",
          gamesPlayed: 3,
          gamesWon: 1,
          metrics: {
            threeDartAverage: 45.12,
            scoringAverage: 48.3,
            checkoutPercentage: 14.2,
          },
          sparklines: [
            {
              kind: "threeDartAverage",
              points: [
                { x: "2026-01-01", y: 40 },
                { x: "2026-01-02", y: 45 },
              ],
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts loading and binds data after fetch", async () => {
    const state = profileDashboard();
    const el = document.createElement("section");
    state.$el = el;

    expect(state.isLoading).toBe(true);
    await state.init();

    expect(state.isLoading).toBe(false);
    expect(state.displayName).toBe("Alex");
    expect(state.gamesPlayed).toBe(3);
  });

  it("mounts charts and binds resize after content is shown", async () => {
    const state = profileDashboard();
    state.$el = document.createElement("section");
    state.$nextTick = (cb: () => void) => {
      cb();
      return Promise.resolve();
    };

    await state.init();

    expect(mountMetricCharts).toHaveBeenCalled();
    expect(bindChartResize).toHaveBeenCalled();
    expect(state.ready).toBe(true);
  });

  it("destroys charts and unbinds resize", async () => {
    const unbind = vi.fn();
    bindChartResize.mockReturnValue(unbind);
    const state = profileDashboard();
    state.$el = document.createElement("section");
    state.$nextTick = (cb: () => void) => {
      cb();
      return Promise.resolve();
    };

    await state.init();
    state.destroy();

    expect(destroyMetricCharts).toHaveBeenCalled();
    expect(unbind).toHaveBeenCalled();
  });

  it("showChart returns false when fewer than two points", () => {
    const state = profileDashboard();
    state.sparklines = [
      { kind: "threeDartAverage", points: [{ x: "2026-01-01", y: 40 }] },
    ];
    expect(state.showChart("threeDartAverage")).toBe(false);
    expect(state.showChart("scoringAverage")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/client/alpine/profile-dashboard.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement profile-dashboard.ts**

Create `app/src/lib/client/alpine/profile-dashboard.ts`:

```ts
import type { Chart } from "chart.js";
import type { ApiResponse, ProfileDashboardSuccess } from "@lib/shared/api/types";
import type { MetricKind, ProfileMetrics, SparklineSeries } from "@lib/shared/stats";
import {
  formatCheckoutPercentage,
  formatScoringAverage,
  formatThreeDartAverage,
} from "@lib/shared/stats";
import {
  bindChartResize,
  destroyMetricCharts,
  mountMetricCharts,
} from "@lib/client/charts/mount-metric-charts";

const EMPTY_METRICS: ProfileMetrics = {
  threeDartAverage: null,
  scoringAverage: null,
  checkoutPercentage: null,
};

interface ProfileDashboardState {
  $el: HTMLElement;
  $nextTick(cb: () => void): Promise<void>;
  isLoading: boolean;
  ready: boolean;
  error: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  metrics: ProfileMetrics;
  sparklines: SparklineSeries[];
  init(): Promise<void>;
  destroy(): void;
  formattedThreeDartAverage(): string;
  formattedScoringAverage(): string;
  formattedCheckoutPercentage(): string;
  showChart(kind: MetricKind): boolean;
}

export function profileDashboard(): ProfileDashboardState {
  const charts = new Map<string, Chart>();
  let unbindResize: (() => void) | null = null;

  return {
    $el: undefined as unknown as HTMLElement,
    $nextTick: undefined as unknown as ProfileDashboardState["$nextTick"],

    isLoading: true,
    ready: false,
    error: "",
    displayName: "You",
    gamesPlayed: 0,
    gamesWon: 0,
    metrics: { ...EMPTY_METRICS },
    sparklines: [],

    formattedThreeDartAverage() {
      return formatThreeDartAverage(this.metrics.threeDartAverage);
    },

    formattedScoringAverage() {
      return formatScoringAverage(this.metrics.scoringAverage);
    },

    formattedCheckoutPercentage() {
      return formatCheckoutPercentage(this.metrics.checkoutPercentage);
    },

    showChart(kind: MetricKind) {
      const series = this.sparklines.find((s) => s.kind === kind);
      return (series?.points.length ?? 0) >= 2;
    },

    async init() {
      try {
        const response = await fetch("/api/profile/dashboard");
        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.ok) {
          this.error = !data.ok ? data.code : "fetch_failed";
          return;
        }

        const dashboard = data as ProfileDashboardSuccess;
        this.displayName = dashboard.displayName?.trim() || "You";
        this.gamesPlayed = dashboard.gamesPlayed;
        this.gamesWon = dashboard.gamesWon;
        this.metrics = dashboard.metrics;
        this.sparklines = dashboard.sparklines;
      } catch {
        this.error = "fetch_failed";
      } finally {
        this.isLoading = false;
      }

      if (this.error) return;

      await this.$nextTick(() => {
        requestAnimationFrame(() => {
          mountMetricCharts(this.$el, this.sparklines, charts);
          unbindResize = bindChartResize(this.$el, charts);
          this.ready = true;
        });
      });
    },

    destroy() {
      unbindResize?.();
      unbindResize = null;
      destroyMetricCharts(charts);
      this.ready = false;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/client/alpine/profile-dashboard.test.ts`  
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/alpine/profile-dashboard.ts tests/lib/client/alpine/profile-dashboard.test.ts
git commit -m "feat(alpine): add profileDashboard factory with chart lifecycle"
```

---

### Task 5: Register factory, remove homeStats

**Files:**
- Modify: `app/src/lib/client/alpine/app.factory.ts`
- Delete: `app/src/lib/client/alpine/home-stats.ts`

- [ ] **Step 1: Swap registration in app.factory.ts**

Replace:

```ts
import { homeStats } from '@lib/client/alpine/home-stats';
```

With:

```ts
import { profileDashboard } from "@lib/client/alpine/profile-dashboard";
```

Replace:

```ts
Alpine.data('homeStats', homeStats);
```

With:

```ts
Alpine.data("profileDashboard", profileDashboard);
```

- [ ] **Step 2: Delete home-stats.ts**

```bash
rm app/src/lib/client/alpine/home-stats.ts
```

- [ ] **Step 3: Run tests**

Run: `cd app && npm test && npx fallow`  
Expected: PASS; fallow reports no false-unused on `profileDashboard` import

- [ ] **Step 4: Commit**

```bash
git add src/lib/client/alpine/app.factory.ts
git rm src/lib/client/alpine/home-stats.ts
git commit -m "refactor(alpine): replace homeStats with profileDashboard"
```

---

### Task 6: Static index.astro

**Files:**
- Modify: `app/src/pages/index.astro`

- [ ] **Step 1: Replace SSR fetch with static prerender shell**

Replace entire `app/src/pages/index.astro` with:

```astro
---
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import ProfileStatsSection from "@components/stats/ProfileStatsSection.astro";
---

<AppLayout>
  <main class="mx-auto w-full max-w-2xl space-y-6 p-4 @sm:p-6">
    <ProfileStatsSection />
  </main>
</AppLayout>
```

- [ ] **Step 2: Run typecheck**

Run: `cd app && npm run check`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "refactor(home): prerender static homepage stats shell"
```

---

### Task 7: ProfileStatsSection + ProfileMetricCard UI

**Files:**
- Modify: `app/src/components/stats/ProfileStatsSection.astro`
- Modify: `app/src/components/stats/ProfileMetricCard.astro`

- [ ] **Step 1: Add skeleton variant to ProfileMetricCard**

Replace `app/src/components/stats/ProfileMetricCard.astro` with:

```astro
---
import type { MetricKind } from "@lib/shared/stats";

interface Props {
  variant?: "skeleton" | "metric";
  label?: string;
  value?: string;
  metricKind?: MetricKind;
  chartToken?: "chart-1" | "chart-2" | "chart-3";
}

const {
  variant = "metric",
  label = "",
  value = "",
  metricKind,
  chartToken,
} = Astro.props;
---
{
  variant === "skeleton" ? (
    <article class="card-metric-liquid w-full min-h-28" aria-hidden="true">
      <div class="card-metric-liquid-content p-3">
        <div class="skeleton mb-2 h-3 w-16 rounded" />
        <div class="skeleton h-6 w-20 rounded" />
      </div>
    </article>
  ) : (
    <article
      class="card-metric-liquid w-full"
      data-metric-kind={metricKind}
      data-chart-token={chartToken}
    >
      <canvas
        class="card-metric-liquid-canvas min-h-0"
        aria-hidden="true"
        x-show={`showChart('${metricKind}')`}
        x-cloak
      />
      <div class="card-metric-liquid-scrim" aria-hidden="true" />
      <div class="card-metric-liquid-content">
        <span class="text-muted-foreground/80 text-xs tracking-wider uppercase">
          {label}
        </span>
        <span
          class="text-foreground font-mono text-xl font-bold"
          x-text={value}
        />
      </div>
    </article>
  )
}
```

Note: `value` on metric cards is an Alpine method name string (e.g. `formattedThreeDartAverage()`), not a static Astro value.

- [ ] **Step 2: Rewrite ProfileStatsSection**

Replace `app/src/components/stats/ProfileStatsSection.astro` with:

```astro
---
import StatsSectionHeader from "./StatsSectionHeader.astro";
import ProfileStatCell from "./ProfileStatCell.astro";
import ProfileMetricCard from "./ProfileMetricCard.astro";
import Skeleton from "@components/ui/Skeleton.astro";
---

<section class="grid grid-cols-2 gap-x-4 gap-y-6" x-data="profileDashboard()">
  <article class="col-span-2 flex flex-col gap-y-4">
  <div x-show="isLoading" x-cloak class="flex flex-col gap-y-4">
    <div>
      <Skeleton variant="text" class="mb-2 h-3 w-20" />
      <Skeleton variant="bar" class="h-6 w-32" />
    </div>
    <div class="grid grid-cols-2 gap-4">
      <Skeleton class="min-h-20 w-full" />
      <Skeleton class="min-h-20 w-full" />
    </div>
    <div class="grid grid-cols-2 gap-4">
      <ProfileMetricCard variant="skeleton" />
      <ProfileMetricCard variant="skeleton" />
      <ProfileMetricCard variant="skeleton" />
    </div>
  </div>

  <div x-show="!isLoading" x-cloak class="flex flex-col gap-y-4">
    <div>
      <span
        class="text-muted-foreground shrink-0 text-xs tracking-wider uppercase"
      >
        Nickname
      </span>
      <h3 class="text-foreground font-bold" x-text="displayName">You</h3>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="flex w-full flex-col items-start justify-center">
        <span class="text-foreground font-mono font-bold" x-text="gamesPlayed">0</span>
        <span class="text-muted-foreground shrink-0 text-xs tracking-wider uppercase">Games Played</span>
      </div>
      <div class="flex w-full flex-col items-start justify-center">
        <span class="text-foreground font-mono font-bold" x-text="gamesWon">0</span>
        <span class="text-muted-foreground shrink-0 text-xs tracking-wider uppercase">Games won</span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <ProfileMetricCard
        label="3 dart avg."
        value='formattedThreeDartAverage()'
        metricKind="threeDartAverage"
        chartToken="chart-1"
      />
      <ProfileMetricCard
        label="Scoring avg."
        value='formattedScoringAverage()'
        metricKind="scoringAverage"
        chartToken="chart-2"
      />
      <ProfileMetricCard
        label="Checkout rate"
        value='formattedCheckoutPercentage()'
        metricKind="checkoutPercentage"
        chartToken="chart-3"
      />
    </div>
  </div>
  </article>
</section>
```

**Fix ProfileStatCell:** `ProfileStatCell` uses Astro `value` prop — check if it supports `x-bind`. Read `ProfileStatCell.astro`; if not, inline stat cells:

```astro
<article class="card w-full p-3">
  <span class="text-foreground font-mono text-xl font-bold" x-text="gamesPlayed">0</span>
  <span class="text-muted-foreground text-xs tracking-wider uppercase">Games Played</span>
</article>
```

Adjust to match existing `ProfileStatCell` markup after reading the file.

- [ ] **Step 3: Remove unused ProfileStatCell import if inlined**

Remove `import ProfileStatCell from "./ProfileStatCell.astro";` from `ProfileStatsSection.astro` since stat cells are inlined with Alpine `x-text`.

- [ ] **Step 4: Commit**

```bash
git add src/components/stats/ProfileStatsSection.astro src/components/stats/ProfileMetricCard.astro
git commit -m "feat(ui): client-bound profile stats section with skeletons"
```

---

### Task 8: Canvas CSS fix

**Files:**
- Modify: `app/src/styles/global.css`

- [ ] **Step 1: Add min-h-0 to canvas rule**

In `app/src/styles/global.css`, update `.card-metric-liquid-canvas`:

```css
.card-metric-liquid-canvas {
  @apply pointer-events-none min-h-0 h-full w-full;
}
```

Remove standalone `min-h-28` from canvas if present (card container keeps `min-h-28`).

- [ ] **Step 2: Commit**

```bash
git add src/styles/global.css
git commit -m "fix(css): min-h-0 on metric chart canvas for grid layout"
```

---

### Task 9: AGENTS.md — anchor architectural pattern

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add Profile stats & Chart.js section**

Insert after the **Alpine client** section (before **Components**):

```markdown
### Profile stats & Chart.js

Client-fetched dashboard data + Alpine-owned chart lifecycle. Spec: `docs/superpowers/specs/2026-06-30-profile-charts-client-design.md`.

| Do | Don't |
| -- | ----- |
| `export const prerender = true` on stats pages; static Astro shell | SSR-fetch `getProfileDashboardData` into page frontmatter |
| Alpine `profileDashboard()` fetches `GET /api/profile/dashboard` | Embed `data-sparklines` JSON on the section |
| `isLoading` + skeleton `x-show`/`x-cloak` until fetch completes | Mount Chart.js in `init()` before content is visible |
| Mount charts after `isLoading=false` → `$nextTick` → `requestAnimationFrame` | Call `new Chart()` synchronously at start of `init()` |
| `min-h-0` on `.card-metric-liquid-canvas` (grid child) | Omit `min-h-0` — canvas gets zero height in CSS grid |
| `mountMetricCharts` + `bindChartResize` from `lib/client/charts/` | Inline Chart.js in `.astro` components |
| `destroy()` → `destroyMetricCharts` + resize unbind | Leave charts/listeners attached on navigation |

**Lifecycle:** `init` → fetch API → bind state → `isLoading=false` → `$nextTick` → `rAF` → `mountMetricCharts` → `bindChartResize` → `ready=true`. Teardown in `destroy()`.

**Reuse:** Future `/statistics` page uses same API + `mountMetricCharts`/`bindChartResize`; add `statsDashboard({ range })` factory when needed.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): anchor profile stats Chart.js client pattern"
```

---

### Task 10: Assembly tests + curl smoke

**Files:**
- Modify: `app/tests/pages/home-stats-assembly.test.ts`
- Modify: `app/scripts/curl-verify-db.sh`

- [ ] **Step 1: Update assembly tests**

Replace `app/tests/pages/home-stats-assembly.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(rel: string) {
  return readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

describe("homepage stats assembly", () => {
  it("index.astro is static prerender shell without SSR dashboard fetch", () => {
    const index = readSource("src/pages/index.astro");
    expect(index).toContain("export const prerender = true");
    expect(index).toContain("ProfileStatsSection");
    expect(index).not.toContain("getProfileDashboardData");
    expect(index).not.toContain("getPreferences");
  });

  it("ProfileStatsSection wires profileDashboard with skeleton lifecycle", () => {
    const section = readSource("src/components/stats/ProfileStatsSection.astro");
    expect(section).toContain('x-data="profileDashboard()"');
    expect(section).toContain('x-show="isLoading"');
    expect(section).toContain('x-show="!isLoading"');
    expect(section).toContain("x-cloak");
    expect(section).not.toContain("data-sparklines");
    expect(section).not.toContain("homeStats");
  });

  it("ProfileMetricCard canvas has min-h-0 for Chart.js grid layout", () => {
    const card = readSource("src/components/stats/ProfileMetricCard.astro");
    expect(card).toContain("card-metric-liquid-canvas");
    expect(card).toContain("min-h-0");
  });
});
```

- [ ] **Step 2: Add dashboard API to curl-verify-db.sh**

Before the final `echo "All curl-verify-db checks passed"`, add:

```bash
DASHBOARD_GET=$(curl -sf -b "$JAR" "$BASE_URL/api/profile/dashboard")
assert_contains "$DASHBOARD_GET" '"ok":true' "profile dashboard GET"
assert_contains "$DASHBOARD_GET" '"gamesPlayed"' "profile dashboard shape"
```

Update home HTML assertion — remove stale checks if index no longer has Quick Start; assert profile dashboard wiring instead:

```bash
HOME_HTML=$(curl -sf -b "$JAR" -L "$BASE_URL/")
assert_contains "$HOME_HTML" 'profileDashboard()' "home page profile dashboard alpine"
assert_contains "$HOME_HTML" 'x-show="isLoading"' "home page stats skeleton"
```

- [ ] **Step 3: Run tests**

Run: `cd app && npm test -- tests/pages/home-stats-assembly.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/pages/home-stats-assembly.test.ts scripts/curl-verify-db.sh
git commit -m "test: update homepage stats assembly and curl dashboard smoke"
```

---

### Task 11: Verification gate

- [ ] **Step 1: Run full static checks**

```bash
cd app && npm run check && npm test && npm run lint && npx fallow && ./scripts/audit-imports.sh
```

Expected: all pass

- [ ] **Step 2: Run curl smoke (dev server required)**

```bash
cd app && ./scripts/curl-verify-db.sh
```

Expected: `All curl-verify-db checks passed`

- [ ] **Step 3: Manual chart verification**

1. `npm run seed:player-stat-completions` (or existing seed script)
2. Open `/` logged in
3. Confirm: skeleton → metrics appear → sparklines render
4. Rotate/narrow viewport (or DevTools device toolbar) → sparklines resize without blank canvas

- [ ] **Step 4: Final commit if any fixups**

```bash
git add -A
git commit -m "chore: profile charts client verification fixups"
```

Only if fixups were needed.

---

## Self-Review (plan vs spec)

| Spec requirement | Task |
| ---------------- | ---- |
| Static prerender homepage | Task 6 |
| GET /api/profile/dashboard | Task 2 |
| profileDashboard factory | Task 4 |
| mountMetricCharts | Task 3 |
| bindChartResize on viewport change | Task 3, 4 |
| min-h-0 canvas | Task 7, 8 |
| Skeleton x-show/x-cloak | Task 7 |
| Remove homeStats / data-sparklines | Task 5, 7 |
| AGENTS.md pattern | Task 9 |
| Tests + curl | Task 10, 11 |
| Future /statistics reuse noted | Task 9 AGENTS.md |

No placeholders. Type names consistent across tasks.
