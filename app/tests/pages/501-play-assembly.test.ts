import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("501 play page assembly", () => {
  it("wires Play.astro with 501 UI shell and summary", () => {
    const source = readSource("src/components/games/501/Play.astro");
    expect(source).toContain('import Summary from "./Summary.astro";');
    expect(source).toContain("PlayShellSkeleton");
    expect(source).toContain("StarterScreen");
    expect(source).toContain("PlayerPanel");
    expect(source).toContain("x-data={`fiveOhOnePlay(");
    expect(source).toContain('x-init="init()"');
    expect(source).toContain('x-show="session?.state.phase === \'play\'"');
    expect(source).toContain('showSummaryModel="showSummary && summary"');
    expect(source).toContain("NumberInputPad");
    expect(source).toContain("<OptionModal");
    expect(source).toContain("formatPlayerName(");
    expect(source).toContain('submitAction="modalSubmit()"');
  });

  it("Summary.astro uses backToGames button", () => {
    const source = readSource("src/components/games/501/Summary.astro");
    expect(source).toContain("SummaryActions");
    expect(source).toContain('variant="back-play"');
  });

  it("Summary.astro delegates to 1P/2P subcomponents", () => {
    const source = readSource("src/components/games/501/Summary.astro");
    expect(source).toContain("MultiplayerSummary");
    expect(source).toContain("SinglePlayerSummary");
    expect(source).toContain("SummaryActions");
    expect(source).toContain("players?.length === 2");
    expect(source).toContain("players?.length === 1");
  });

  it("MultiplayerSummary uses head-to-head components", () => {
    const source = readSource("src/components/games/501/MultiplayerSummary.astro");
    expect(source).toContain("SummaryMatchHeader");
    expect(source).toContain("SummaryComparisonStatRow");
    expect(source).toContain("formatSummaryAverage");
  });

  it("SinglePlayerSummary uses stat rows without legacy fields", () => {
    const source = readSource("src/components/games/501/SinglePlayerSummary.astro");
    expect(source).toContain("SummaryStatRow");
    expect(source).toContain("formatSummaryAverage");
    expect(source).not.toContain("resultLabel");
    expect(source).not.toContain("userThreeDartAverage");
  });

  it("starts 501 via POST form validation", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).toContain("parseFiveOhOneSettingsFormData");
    expect(source).toContain("buildFiveOhOneSession");
    expect(source).toContain('slug === "501"');
  });

  it("settings shell uses form POST with player picker", () => {
    const source = readSource(
      "src/components/games/501/FiveOhOneSettingsShell.astro",
    );
    expect(source).toContain('method="POST"');
    expect(source).toContain("<slot />");
    expect(source).toContain("GuestNameModal");
    expect(source).toContain('label="Play"');
  });
});
