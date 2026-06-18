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
      'import NumberInputPad from "@components/ui/NumberInputPad.astro";'
    );
    expect(source).toContain('import ScoreCard from "./ScoreCard.astro";');
    expect(source).toContain('import ProgressBar from "./ProgressBar.astro";');
    expect(source).toContain('import Summary from "./Summary.astro";');
    expect(source).toContain('import LeaveIcon from "@icons/leave.svg";');
    expect(source).toContain("x-data={`scoreTrainingPlay(");
    expect(source).toContain('x-init="init()"');
    expect(source).toContain('@click="leave()"');
    expect(source).toContain('x-show="!showSummary"');
    expect(source).toContain("<ProgressBar />");
    expect(source).toContain("<ScoreCard />");
    expect(source).toContain("<NumberInputPad");
    expect(source).toContain("<Summary />");
    expect(source).toContain('<p x-show="error" x-cloak x-text="error"');
  });

  it("routes score-training play through persisted session", () => {
    const source = readSource("src/pages/games/[game].astro");

    expect(source).toContain(
      'import { getScoreTrainingSession } from "@lib/server/data/score-training-session";'
    );
    expect(source).toContain('slug === "score-training"');
    expect(source).toContain("await getScoreTrainingSession(session.userId)");
    expect(source).toContain(
      'if (slug === "score-training" && !scoreTrainingSession)'
    );
    expect(source).toContain("return Astro.redirect(`/games/settings-${slug}`)");
    expect(source).toContain(
      '<Play displayName={game.displayName} gameSession={scoreTrainingSession!} />'
    );
  });

  it("registers scoreTrainingPlay in alpine app factory", () => {
    const source = readSource("src/lib/client/alpine/app.factory.ts");
    expect(source).toContain('Alpine.data("scoreTrainingPlay", scoreTrainingPlay);');
  });

  it("guards summary bindings when summary is null before game completes", () => {
    const source = readSource("src/components/games/score-training/Summary.astro");

    expect(source).toContain("?.totalScore ?? 0");
    expect(source).toContain("?.roundsPlayed ?? 0");
    expect(source).toContain("?.dartsThrown ?? 0");
  });
});
