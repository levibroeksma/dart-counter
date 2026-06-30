import { describe, expect, it } from "vitest";
import { formatDartbotLevelPreview } from "@lib/shared/dartbot";

describe("formatDartbotLevelPreview", () => {
  it("formats anchor level 1", () => {
    expect(formatDartbotLevelPreview(1)).toEqual({
      threeDartAverage: "30–40",
      checkoutSuccessRate: "8–30%",
    });
  });

  it("formats anchor level 10", () => {
    expect(formatDartbotLevelPreview(10)).toEqual({
      threeDartAverage: "67–77",
      checkoutSuccessRate: "30–50%",
    });
  });

  it("interpolates level 3 between anchors 1 and 5", () => {
    const preview = formatDartbotLevelPreview(3);
    const level1 = formatDartbotLevelPreview(1);
    const level5 = formatDartbotLevelPreview(5);

    const [lo3] = preview.threeDartAverage.split("–").map(Number);
    const [lo1] = level1.threeDartAverage.split("–").map(Number);
    const [lo5] = level5.threeDartAverage.split("–").map(Number);

    expect(lo3).toBeGreaterThan(lo1);
    expect(lo3).toBeLessThan(lo5);
  });
});
