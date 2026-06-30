import { describe, it, expect } from "vitest";
import { getCheckoutHint } from "@lib/shared/darts";

describe("getCheckoutHint", () => {
  it("returns route for target 41", () => {
    expect(getCheckoutHint(41)).toEqual({ segments: ["9", "D16"] });
  });

  it("returns route for target 40", () => {
    expect(getCheckoutHint(40)).toEqual({ segments: ["D20"] });
  });

  it("returns route for target 170", () => {
    expect(getCheckoutHint(170)).toEqual({ segments: ["T20", "T20", "Bull"] });
  });

  it("returns null for bogey targets", () => {
    expect(getCheckoutHint(169)).toBeNull();
  });

  it("returns null for unknown targets", () => {
    expect(getCheckoutHint(999)).toBeNull();
  });
});
