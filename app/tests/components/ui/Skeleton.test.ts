import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Skeleton.astro", () => {
  it("supports text, bar, and block variants with aria-hidden", () => {
    const source = readSource("src/components/ui/Skeleton.astro");
    expect(source).toContain('"text" | "bar" | "block"');
    expect(source).toContain('class:list={["skeleton"');
    expect(source).toContain('aria-hidden="true"');
  });
});

describe(".skeleton utility", () => {
  it("defines pulse animation and reduced-motion fallback", () => {
    const source = readSource("src/styles/global.css");
    expect(source).toContain(".skeleton");
    expect(source).toContain("prefers-reduced-motion");
    expect(source).toContain("animate-pulse");
    expect(source).toContain("--color-gray-900");
  });
});
