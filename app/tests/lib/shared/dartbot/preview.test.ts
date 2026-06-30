import { describe, expect, it } from "vitest";
import { formatDartbotLevelPreview } from "@lib/shared/dartbot";

describe("formatDartbotLevelPreview", () => {
  it("formats anchor level 1", () => {
    expect(formatDartbotLevelPreview(1)).toEqual({
      threeDartAverage: "30–40",
      checkoutAverage: "8",
      checkoutSuccessRate: "30%",
    });
  });

  it("formats anchor level 10", () => {
    expect(formatDartbotLevelPreview(10)).toEqual({
      threeDartAverage: "67–77",
      checkoutAverage: "30",
      checkoutSuccessRate: "55%",
    });
  });

  it("formats level 15 with open-ended scoring average", () => {
    expect(formatDartbotLevelPreview(15)).toEqual({
      threeDartAverage: "90+",
      checkoutAverage: "45",
      checkoutSuccessRate: "80%",
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
