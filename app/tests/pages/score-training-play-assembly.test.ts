import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("score-training play page assembly", () => {
  it("wires Play.astro with score-training UI shell", () => {
    const source = readSource("src/components/games/score-training/Play.astro");

    expect(source).toContain(
      'import NumberInputPad from "@components/ui/NumberInputPad.astro";',
    );
    expect(source).toContain('import ScoreCard from "./ScoreCard.astro";');
    expect(source).toContain('import ProgressBar from "./ProgressBar.astro";');
    expect(source).toContain('import Summary from "./Summary.astro";');
    expect(source).toContain('import LeaveIcon from "@icons/leave.svg";');
    expect(source).toContain("x-data={`scoreTrainingPlay(");
    expect(source).toContain('x-init="init()"');
    expect(source).toContain('@click="leave()"');
    expect(source).toContain('x-show="ready && !showSummary"');
    expect(source).toContain("<ProgressBar />");
    expect(source).toContain("<ScoreCard />");
    expect(source).toContain("<NumberInputPad");
    expect(source).toContain("<Summary");
    expect(source).toContain('<p x-show="error" x-cloak x-text="error"');
  });

  it("starts score-training via POST form validation", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).toContain("parseScoreTrainingSettingsFormData");
    expect(source).toContain("buildScoreTrainingSession");
    expect(source).toContain('Astro.request.method === "POST"');
    expect(source).toContain('slug === "score-training"');
    expect(source).not.toContain("getScoreTrainingSession");
  });

  it("does not server-redirect score-training GET ($persist restores client-side)", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).not.toMatch(
      /slug === "score-training"[\s\S]*return Astro\.redirect\(`\/games\/settings-\$\{slug\}`\)/,
    );
  });

  it("Play.astro accepts optional gameSession, skeleton shells, and $persist in play factory", () => {
    const playSource = readSource("src/components/games/score-training/Play.astro");
    const factorySource = readSource("src/lib/client/alpine/games/score-training.play.ts");
    expect(playSource).toContain("gameSession?:");
    expect(playSource).toContain("PlayShellSkeleton");
    expect(playSource).toContain("SummarySkeleton");
    expect(playSource).toContain('x-show="!ready"');
    expect(factorySource).toContain("$persist");
    expect(factorySource).toContain("ready: false");
    expect(factorySource).toContain(".using(sessionStorage)");
  });

  it("registers scoreTrainingPlay in alpine app factory", () => {
    const source = readSource("src/lib/client/alpine/app.factory.ts");
    expect(source).toContain(
      'Alpine.data("scoreTrainingPlay", scoreTrainingPlay);',
    );
  });

  it("renders skeleton shells and swaps on ready / summary", () => {
    const source = readSource("src/components/games/score-training/Play.astro");
    expect(source).toContain('import PlayShellSkeleton from "./PlayShellSkeleton.astro"');
    expect(source).toContain('import SummarySkeleton from "./SummarySkeleton.astro"');
    expect(source).toContain('x-show="!ready"');
    expect(source).toContain('x-show="ready && !showSummary"');
    expect(source).toContain('x-show="showSummary && !summary"');
    expect(source).toContain('showSummaryModel="showSummary && summary"');
    expect(source).toContain(":aria-busy");
    expect(source).toContain("<PlayShellSkeleton />");
    expect(source).toContain("<SummarySkeleton />");
  });

  it("guards summary bindings when summary is null before game completes", () => {
    const source = readSource(
      "src/components/games/score-training/Summary.astro",
    );

    expect(source).toContain("?.totalScore ?? 0");
    expect(source).toContain("?.roundsPlayed ?? 0");
    expect(source).toContain("?.dartsThrown ?? 0");
  });
});
