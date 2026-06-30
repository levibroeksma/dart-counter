import { describe, expect, it } from "vitest";
import { classifyVisit, resolve501CheckoutModal } from "@lib/shared/games/501";

describe("resolve501CheckoutModal", () => {
  it("returns finish modal on checkout", () => {
    const outcome = classifyVisit(40, 40);
    const result = resolve501CheckoutModal(40, 40, outcome);
    expect(result?.kind).toBe("finish");
    expect(result?.questions.map((q) => q.id)).toEqual([
      "dartsForFinish",
      "dartsOnDouble",
    ]);
  });

  it("returns partial modal for 60→47", () => {
    const outcome = classifyVisit(60, 13);
    const result = resolve501CheckoutModal(60, 13, outcome);
    expect(result?.kind).toBe("partial");
    expect(result?.questions).toHaveLength(1);
    expect(result?.questions[0]?.options).toEqual([0, 1]);
  });

  it("returns null for 60→51", () => {
    const outcome = classifyVisit(60, 9);
    expect(resolve501CheckoutModal(60, 9, outcome)).toBeNull();
  });
});
