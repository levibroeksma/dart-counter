import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(rel: string) {
  return readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

describe("homepage stats assembly", () => {
  it("index.astro is a client-data shell without SSR dashboard fetch", () => {
    const index = readSource("src/pages/index.astro");
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
