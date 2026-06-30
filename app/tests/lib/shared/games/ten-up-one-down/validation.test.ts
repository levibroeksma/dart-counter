import { describe, it, expect } from "vitest";
import { validateTenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("validateTenUpOneDownSettings", () => {
  it("accepts valid rounds mode", () => {
    const result = validateTenUpOneDownSettings({ endMode: "rounds", roundCount: 10 });
    expect(result).toEqual({ valid: true, value: { endMode: "rounds", roundCount: 10 } });
  });

  it("accepts valid timed mode", () => {
    const result = validateTenUpOneDownSettings({ endMode: "timed", playtimeSeconds: 600 });
    expect(result).toEqual({ valid: true, value: { endMode: "timed", playtimeSeconds: 600 } });
  });

  it("rejects roundCount out of bounds", () => {
    const result = validateTenUpOneDownSettings({ endMode: "rounds", roundCount: 0 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe(MessageCode.INVALID_GAME_SETTINGS);
  });

  it("rejects playtime out of bounds", () => {
    const result = validateTenUpOneDownSettings({ endMode: "timed", playtimeSeconds: 60 });
    expect(result.valid).toBe(false);
  });

  it("rejects missing endMode", () => {
    const result = validateTenUpOneDownSettings({ roundCount: 10 });
    expect(result.valid).toBe(false);
  });
});
