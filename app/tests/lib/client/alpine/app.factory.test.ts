import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Alpine app factory", () => {
  it("registers the persist plugin", () => {
    const source = readSource("src/lib/client/alpine/app.factory.ts");
    expect(source).toContain('@alpinejs/persist');
    expect(source).toContain("Alpine.plugin(persist)");
  });
});
