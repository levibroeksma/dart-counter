import { describe, it, expect } from "vitest";
import { scoreTrainingSettings } from "@lib/client/alpine/games/score-training.settings";

describe("scoreTrainingSettings", () => {
  it("exposes endMode for radio x-model binding", () => {
    const component = scoreTrainingSettings();
    expect(component.endMode).toBe("rounds");
  });
});
