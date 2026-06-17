// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { scoreTrainingSettings } from "@lib/client/alpine/games/score-training.settings";

describe("scoreTrainingSettings", () => {
  it("converts playtime minutes to seconds", () => {
    const component = scoreTrainingSettings("/games/score-training", false);

    const form = document.createElement("form");
    form.innerHTML = `
      <input name="endMode" value="timed" />
      <input name="playtimeMinutes" value="10" />
    `;

    const settings = component.formDataToSettings(form);

    expect(settings).toEqual({
      endMode: "timed",
      playtimeSeconds: 600,
    });
    expect(settings).not.toHaveProperty("playtimeMinutes");
  });
});
