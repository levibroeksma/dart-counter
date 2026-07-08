import { describe, expect, it } from "vitest";
import {
  formatCheckoutPercentage,
  formatScoringAverage,
  formatThreeDartAverage,
} from "@lib/shared/stats";

describe("format-profile", () => {
  it("formats averages and empty state", () => {
    expect(formatThreeDartAverage(45.123)).toBe("45.12");
    expect(formatScoringAverage(48.34)).toBe("48.3");
    expect(formatCheckoutPercentage(14.156)).toBe("14.2%");
    expect(formatThreeDartAverage(null)).toBe("—");
  });
});
