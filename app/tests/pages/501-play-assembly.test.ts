import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("501 play page assembly", () => {
  it("starts 501 via POST form validation", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).toContain("parseFiveOhOneSettingsFormData");
    expect(source).toContain("validateFiveOhOneSettings");
    expect(source).toContain("buildFiveOhOneSession");
    expect(source).toContain('slug === "501"');
    expect(source).toContain('Astro.request.method === "POST"');
  });

  it("skips play count increment for 501 on GET", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).toContain('slug !== "501"');
  });

  it("renders 501 Play branch with gameSession and userId", () => {
    const source = readSource("src/pages/games/[game].astro");
    expect(source).toMatch(
      /slug === "501"[\s\S]*<Play[\s\S]*displayName=\{game\.displayName\}[\s\S]*gameSession=\{fiveOhOneSession\}[\s\S]*userId=\{session\.userId\}/,
    );
  });
});
