/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readChartColor, withAlpha } from "@lib/client/charts/chart-theme";
import { createSparkline, destroySparkline } from "@lib/client/charts/sparkline";

const { chartFactory, chartRegister } = vi.hoisted(() => ({
  chartFactory: vi.fn(),
  chartRegister: vi.fn(),
}));

vi.mock("chart.js", () => {
  class Chart {
    static register = chartRegister;
    destroy = vi.fn();

    constructor(canvas: HTMLCanvasElement, config: unknown) {
      chartFactory(canvas, config, this);
    }
  }

  return {
    Chart,
    LineController: class {},
    LineElement: class {},
    PointElement: class {},
    LinearScale: class {},
    CategoryScale: class {},
    Filler: class {},
  };
});

describe("chart theme utils", () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty("--chart-1");
    document.documentElement.style.removeProperty("--chart-2");
    document.documentElement.style.removeProperty("--chart-3");
  });

  it("reads hsl from css variable token", () => {
    document.documentElement.style.setProperty("--chart-1", "220 90% 50%");
    expect(readChartColor("chart-1")).toBe("hsl(220 90% 50%)");
  });

  it("falls back to default color when css variable missing", () => {
    expect(readChartColor("chart-2")).toBe("hsl(248 100% 66%)");
  });

  it("converts hsl color to hsla with alpha", () => {
    expect(withAlpha("hsl(220 90% 50%)", 0.4)).toBe("hsla(220 90% 50% / 0.4)");
  });
});

describe("sparkline chart utils", () => {
  beforeEach(() => {
    chartFactory.mockReset();
    chartRegister.mockClear();
    document.documentElement.style.setProperty("--chart-1", "248 100% 66%");
  });

  it("creates sparkline even with empty points", () => {
    const canvas = document.createElement("canvas");
    createSparkline(canvas, [], "chart-1");

    expect(chartFactory).toHaveBeenCalledTimes(1);
    const [, config] = chartFactory.mock.calls[0] as [HTMLCanvasElement, any];
    expect(config.data.labels).toEqual([]);
    expect(config.data.datasets[0].data).toEqual([]);
  });

  it("destroySparkline safely handles undefined chart", () => {
    expect(() => destroySparkline(undefined)).not.toThrow();
  });
});
