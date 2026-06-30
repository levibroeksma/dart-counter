import { describe, it, expect } from "vitest";
import { parseScoreTrainingSettingsFormData } from "@lib/shared/games/score-training";

describe("parseScoreTrainingSettingsFormData", () => {
  it("maps roundCount as number for rounds mode", () => {
    const formData = new FormData();
    formData.set("endMode", "rounds");
    formData.set("roundCount", "10");

    expect(parseScoreTrainingSettingsFormData(formData)).toEqual({
      endMode: "rounds",
      roundCount: 10,
    });
  });

  it("converts playtimeMinutes to playtimeSeconds for timed mode", () => {
    const formData = new FormData();
    formData.set("endMode", "timed");
    formData.set("playtimeMinutes", "10");

    expect(parseScoreTrainingSettingsFormData(formData)).toEqual({
      endMode: "timed",
      playtimeSeconds: 600,
    });
  });
});
