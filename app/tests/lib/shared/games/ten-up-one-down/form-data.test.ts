import { describe, it, expect } from "vitest";
import { parseTenUpOneDownSettingsFormData } from "@lib/shared/games/ten-up-one-down";

describe("parseTenUpOneDownSettingsFormData", () => {
  it("maps endMode and roundCount from form fields", () => {
    const formData = new FormData();
    formData.set("endMode", "rounds");
    formData.set("roundCount", "10");

    expect(parseTenUpOneDownSettingsFormData(formData)).toEqual({
      endMode: "rounds",
      roundCount: 10,
    });
  });

  it("converts playtime minutes to seconds", () => {
    const formData = new FormData();
    formData.set("endMode", "timed");
    formData.set("playtimeMinutes", "10");

    expect(parseTenUpOneDownSettingsFormData(formData)).toEqual({
      endMode: "timed",
      playtimeSeconds: 600,
    });
  });

  it("returns empty object for empty form", () => {
    expect(parseTenUpOneDownSettingsFormData(new FormData())).toEqual({});
  });
});
