import { describe, it, expect } from "vitest";
import { resolveRoundOutcome } from "@lib/shared/games/ten-up-one-down/outcome";

describe("resolveRoundOutcome", () => {
  it("empty score is failure", () => {
    expect(resolveRoundOutcome(null, 41)).toBe("failure");
    expect(resolveRoundOutcome("", 41)).toBe("failure");
  });

  it("wrong number is failure", () => {
    expect(resolveRoundOutcome("40", 41)).toBe("failure");
  });

  it("matching target is success", () => {
    expect(resolveRoundOutcome("41", 41)).toBe("success");
  });

  it("rejects invalid numeric input", () => {
    expect(resolveRoundOutcome("abc", 41)).toBeNull();
    expect(resolveRoundOutcome("181", 41)).toBeNull();
  });
});
