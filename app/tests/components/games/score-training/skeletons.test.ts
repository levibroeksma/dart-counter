import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("score-training skeleton components", () => {
  it("ProgressBarSkeleton mirrors game-panel height and uses Skeleton", () => {
    const source = readSource("src/components/games/score-training/ProgressBarSkeleton.astro");
    expect(source).toContain('import Skeleton from "@components/ui/Skeleton.astro"');
    expect(source).toContain("game-panel");
    expect(source).not.toContain("x-data");
  });

  it("ScoreCardSkeleton mirrors h-40 score card layout", () => {
    const source = readSource("src/components/games/score-training/ScoreCardSkeleton.astro");
    expect(source).toContain("h-40");
    expect(source).toContain('data-testid="st-score-card-skeleton"');
  });

  it("NumberInputPadSkeleton renders score row and 4x3 grid", () => {
    const source = readSource("src/components/games/score-training/NumberInputPadSkeleton.astro");
    expect(source).toContain('data-testid="st-number-pad-skeleton"');
    expect(source).toMatch(/grid-cols-4/);
  });

  it("SummarySkeleton renders definition-list row placeholders", () => {
    const source = readSource("src/components/games/score-training/SummarySkeleton.astro");
    expect(source).toContain('data-testid="st-summary-skeleton"');
    expect(source).toContain("grid-cols-2");
  });

  it("PlayShellSkeleton composes region skeletons", () => {
    const source = readSource("src/components/games/score-training/PlayShellSkeleton.astro");
    expect(source).toContain("<ProgressBarSkeleton");
    expect(source).toContain("<ScoreCardSkeleton");
    expect(source).toContain("<NumberInputPadSkeleton");
    expect(source).not.toContain("x-show");
  });
});
