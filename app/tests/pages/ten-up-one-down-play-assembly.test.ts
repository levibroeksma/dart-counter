import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("ten-up-one-down play page assembly", () => {
  it("wires Play.astro with TUOD UI shell and summary", () => {
    const source = readSource("src/components/games/ten-up-one-down/Play.astro");
    expect(source).toContain('import Summary from "./Summary.astro";');
    expect(source).toContain("PlayShellSkeleton");
    expect(source).toContain("SummarySkeleton");
    expect(source).toContain("x-data={`tenUpOneDownPlay(");
    expect(source).toContain('x-init="init()"');
    expect(source).toContain('x-show="ready && !showSummary"');
    expect(source).toContain('x-show="showSummary && !summary"');
    expect(source).toContain('showSummaryModel="showSummary && summary"');
    expect(source).toContain("<OptionModal");
  });

  it("starts TUOD via POST form validation", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).toContain("parseTenUpOneDownSettingsFormData");
    expect(source).toContain("buildTenUpOneDownSession");
    expect(source).toContain('slug === "ten-up-one-down"');
    expect(source).not.toContain("getTenUpOneDownSession");
  });

  it("settings shell uses form POST without resume/abandon", () => {
    const source = readSource(
      "src/components/games/ten-up-one-down/TenUpOneDownSettingsShell.astro",
    );
    expect(source).toContain('method="POST"');
    expect(source).not.toContain("hasActiveSession");
    expect(source).not.toContain("resume()");
    expect(source).not.toContain("abandon()");
  });

  it("Summary.astro uses shared SummaryActions", () => {
    const source = readSource("src/components/games/ten-up-one-down/Summary.astro");
    expect(source).toContain("SummaryActions");
    expect(source).toContain('variant="yes-no"');
  });
});
