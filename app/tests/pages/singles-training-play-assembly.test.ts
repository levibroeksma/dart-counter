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
    expect(source).toContain('x-show="!showSummary"');
    expect(source).toContain("<ScorePanel />");
    expect(source).toContain("<TargetLabel />");
    expect(source).toContain("<DartInput />");
    expect(source).toContain("<Summary />");
    expect(source).toContain('<p x-show="error" x-cloak x-text="error"');
  });

  it("routes singles-training play through persisted session", () => {
    const source = readSource("src/pages/games/[game].astro");

    expect(source).toContain(
      'import { getSinglesTrainingSession } from "@lib/server/data/singles-training-session";'
    );
    expect(source).toContain('slug === "singles-training"');
    expect(source).toContain("await getSinglesTrainingSession(session.username)");
    expect(source).toContain(
      'if (slug === "singles-training" && !singlesTrainingSession)'
    );
    expect(source).toContain("return Astro.redirect(`/games/settings-${slug}`)");
    expect(source).toContain(
      '<Play displayName={game.displayName} gameSession={singlesTrainingSession!} />'
    );
  });

  it("wires singles-training settings shell with active-session check", () => {
    const source = readSource("src/pages/games/settings-[game].astro");

    expect(source).toContain(
      'import SinglesTrainingSettingsShell from "@components/games/singles-training/SinglesTrainingSettingsShell.astro";'
    );
    expect(source).toContain(
      'import { getSinglesTrainingSession } from "@lib/server/data/singles-training-session";'
    );
    expect(source).toContain(
      'import { isSinglesTrainingSession } from "@lib/shared/games/singles-training/session";'
    );
    expect(source).toContain('slug === "singles-training"');
    expect(source).toContain("await getSinglesTrainingSession(auth.username)");
    expect(source).toContain("hasActiveSession = isSinglesTrainingSession(activeSession)");
    expect(source).toContain("<SinglesTrainingSettingsShell game={game} hasActiveSession={hasActiveSession}>");
  });

  it("registers singles-training alpine components in app factory", () => {
    const source = readSource("src/lib/client/alpine/app.factory.ts");
    expect(source).toContain(
      'Alpine.data("singlesTrainingSettings", singlesTrainingSettings);'
    );
    expect(source).toContain('Alpine.data("singlesTrainingPlay", singlesTrainingPlay);');
  });
});
