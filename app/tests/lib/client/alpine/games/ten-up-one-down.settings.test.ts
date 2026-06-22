import { describe, it, expect } from "vitest";
import { tenUpOneDownSettings } from "@lib/client/alpine/games/ten-up-one-down.settings";

describe("tenUpOneDownSettings", () => {
  it("defaults endMode to rounds", () => {
    const component = tenUpOneDownSettings();
    expect(component.endMode).toBe("rounds");
  });
});
