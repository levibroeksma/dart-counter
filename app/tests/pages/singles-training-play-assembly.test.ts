import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("singles-training play page assembly", () => {
  it("wires Play.astro with singles-training UI shell", () => {
    const source = readSource("src/components/games/singles-training/Play.astro");

    expect(source).toContain('import ScorePanel from "./ScorePanel.astro";');
    expect(source).toContain('import TargetLabel from "./TargetLabel.astro";');
    expect(source).toContain('import DartInput from "./DartInput.astro";');
    expect(source).toContain('import Summary from "./Summary.astro";');
    expect(source).toContain('import LeaveIcon from "@icons/leave.svg";');
    expect(source).toContain("x-data={`singlesTrainingPlay(");
    expect(source).toContain('@click="leave()"');
    expect(source).toContain('x-show="ready && !showSummary"');
    expect(source).toContain("<ScorePanel />");
    expect(source).toContain("<TargetLabel />");
    expect(source).toContain("<DartInput />");
    expect(source).toContain("<Summary");
    expect(source).toContain('<p x-show="error" x-cloak x-text="error"');
  });

  it("Play.astro accepts optional gameSession, skeleton shells, and $persist", () => {
    const playSource = readSource("src/components/games/singles-training/Play.astro");
    const factorySource = readSource("src/lib/client/alpine/games/singles-training.play.ts");
    expect(playSource).toContain("gameSession?:");
    expect(playSource).toContain("PlayShellSkeleton");
    expect(playSource).toContain("SummarySkeleton");
    expect(playSource).toContain('x-init="init()"');
    expect(playSource).toContain('x-show="!ready"');
    expect(playSource).toContain('x-show="ready && !showSummary"');
    expect(playSource).toContain('x-show="showSummary && !summary"');
    expect(playSource).toContain('showSummaryModel="showSummary && summary"');
    expect(playSource).toContain('loadingModel="loading"');
    expect(factorySource).toContain("$persist");
    expect(factorySource).toContain(".using(sessionStorage)");
  });

  it("starts singles-training via POST form validation", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).toContain("parseSinglesTrainingSettingsFormData");
    expect(source).toContain("buildSinglesTrainingSession");
    expect(source).toContain('slug === "singles-training"');
    expect(source).not.toContain("getSinglesTrainingSession");
  });

  it("does not server-redirect singles-training GET ($persist restores client-side)", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).not.toMatch(
      /slug === "singles-training"[\s\S]*return Astro\.redirect\(`\/games\/settings-\$\{slug\}`\)/,
    );
  });

  it("wires singles-training settings shell without active-session check", () => {
    const source = readSource("src/pages/games/settings-[game].astro");

    expect(source).toContain(
      'import SinglesTrainingSettingsShell from "@components/games/singles-training/SinglesTrainingSettingsShell.astro";'
    );
    expect(source).toContain('slug === "singles-training"');
    expect(source).not.toContain("getSinglesTrainingSession");
    expect(source).not.toContain("isSinglesTrainingSession");
    expect(source).toContain("<SinglesTrainingSettingsShell game={game}>");
    expect(source).not.toContain(
      "<SinglesTrainingSettingsShell game={game} hasActiveSession={hasActiveSession}>",
    );
  });

  it("settings shell uses form POST without resume/abandon", () => {
    const source = readSource(
      "src/components/games/singles-training/SinglesTrainingSettingsShell.astro",
    );
    expect(source).toContain('method="POST"');
    expect(source).toContain("action={playUrl}");
    expect(source).not.toContain("hasActiveSession");
    expect(source).not.toContain("resume()");
    expect(source).not.toContain("abandon()");
  });

  it("registers singles-training alpine components in app factory", () => {
    const source = readSource("src/lib/client/alpine/app.factory.ts");
    expect(source).not.toContain('Alpine.data("singlesTrainingSettings"');
    expect(source).toContain('Alpine.data("singlesTrainingPlay", singlesTrainingPlay);');
  });

  it("Summary.astro uses shared SummaryActions", () => {
    const source = readSource("src/components/games/singles-training/Summary.astro");
    expect(source).toContain("SummaryActions");
    expect(source).toContain('variant="yes-no"');
  });
});
