import { describe, expect, it } from "vitest";
import { nextCheckoutTarget } from "@lib/shared/dartbot";

describe("nextCheckoutTarget", () => {
  it("returns first segment from checkout hint", () => {
    expect(nextCheckoutTarget(40)?.label).toBe("D20");
  });

  it("returns null for non-finishable target without hint", () => {
    expect(nextCheckoutTarget(169)).toBeNull();
  });
});
