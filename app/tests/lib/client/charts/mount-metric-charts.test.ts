/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chart } from "chart.js";
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
    <article class="card-metric-liquid" data-metric-kind="threeDartAverage" data-chart-token="chart-1">
      <canvas class="card-metric-liquid-canvas"></canvas>
    </article>
    <article class="card-metric-liquid" data-metric-kind="scoringAverage" data-chart-token="chart-2">
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
    const chart = { resize: vi.fn() } as unknown as Chart;
    const charts = new Map<string, Chart>([["threeDartAverage", chart]]);
    destroyMetricCharts(charts);

    expect(destroySparkline).toHaveBeenCalledWith(chart);
    expect(charts.size).toBe(0);
  });
});

describe("bindChartResize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls resize on all charts when window resizes", () => {
    const resize = vi.fn();
    const charts = new Map<string, Chart>([
      ["threeDartAverage", { resize } as unknown as Chart],
    ]);
    const root = document.createElement("section");
    document.body.appendChild(root);

    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    const unbind = bindChartResize(root, charts);
    window.dispatchEvent(new Event("resize"));
    for (const cb of rafCallbacks) {
      cb(0);
    }

    expect(resize).toHaveBeenCalled();
    unbind();
    document.body.removeChild(root);
  });
});
