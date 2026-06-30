import { describe, it, expect } from "vitest";
import { parseSinglesTrainingSettingsFormData } from "@lib/shared/games/singles-training";

describe("parseSinglesTrainingSettingsFormData", () => {
  it("maps direction, mode, and scoring from form fields", () => {
    const formData = new FormData();
    formData.set("direction", "high-to-low");
    formData.set("mode", "hard");
    formData.set("scoring", "uniform");

    expect(parseSinglesTrainingSettingsFormData(formData)).toEqual({
      direction: "high-to-low",
      mode: "hard",
      scoring: "uniform",
    });
  });

  it("returns empty object for empty form", () => {
    expect(parseSinglesTrainingSettingsFormData(new FormData())).toEqual({});
  });
});
