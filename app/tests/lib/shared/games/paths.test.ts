import { describe, it, expect } from "vitest";
import { settingsPath, playPath } from "@lib/shared/games/paths";

describe("game paths", () => {
  it("builds settings path", () => {
    expect(settingsPath("501")).toBe("/games/settings-501");
    expect(settingsPath("ten-up-one-down")).toBe(
      "/games/settings-ten-up-one-down"
    );
    expect(settingsPath("score-training")).toBe("/games/settings-score-training");
  });

  it("builds play path", () => {
    expect(playPath("501")).toBe("/games/501");
    expect(playPath("121")).toBe("/games/121");
    expect(playPath("score-training")).toBe("/games/score-training");
  });
});
