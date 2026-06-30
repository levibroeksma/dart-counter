import { describe, it, expect } from "vitest";
import { createRng, hashSeed } from "@lib/shared/dartbot";

describe("rng", () => {
  it("is deterministic for same seed", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBe(b.next());
  });

  it("serializes and restores state", () => {
    const rng = createRng(99);
    rng.next();
    rng.next();
    const state = rng.getState();
    const restored = createRng(99);
    restored.setState(state);
    const original = createRng(99);
    original.next();
    original.next();
    expect(restored.next()).toBe(original.next());
  });

  it("hashes session seed from createdAt and level", () => {
    expect(hashSeed("2026-06-29T12:00:00.000Z", 10)).toBe(
      hashSeed("2026-06-29T12:00:00.000Z", 10),
    );
    expect(hashSeed("2026-06-29T12:00:00.000Z", 10)).not.toBe(
      hashSeed("2026-06-29T12:00:00.000Z", 11),
    );
  });
});
