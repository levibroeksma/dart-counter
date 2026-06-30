import { describe, it, expect } from "vitest";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  validateFiveOhOneSettings,
  validateVisitScore,
} from "@lib/shared/games/501/validation";

describe("validateFiveOhOneSettings", () => {
  const userPlayer = { id: "u1", type: "user" as const, name: "Levi" };

  it("accepts valid 1-player legs settings", () => {
    const result = validateFiveOhOneSettings({
      matchMode: "first-to",
      targetCount: 3,
      unit: "legs",
      players: [userPlayer],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects empty guest name", () => {
    const result = validateFiveOhOneSettings({
      matchMode: "best-of",
      targetCount: 3,
      unit: "legs",
      players: [userPlayer, { id: "g1", type: "guest", name: "  " }],
    });
    expect(result).toEqual({
      valid: false,
      code: MessageCode.INVALID_GAME_SETTINGS,
    });
  });

  it("rejects more than 2 players", () => {
    const result = validateFiveOhOneSettings({
      matchMode: "best-of",
      targetCount: 3,
      unit: "legs",
      players: [userPlayer, userPlayer, userPlayer],
    });
    expect(result).toEqual({
      valid: false,
      code: MessageCode.INVALID_GAME_SETTINGS,
    });
  });

  it("accepts dartbot player with level 10", () => {
    const result = validateFiveOhOneSettings({
      matchMode: "first-to",
      targetCount: 3,
      unit: "legs",
      players: [
        userPlayer,
        { id: "db1", type: "dartbot", name: "DartBot", level: 10 },
      ],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.players[1]).toEqual({
        id: "db1",
        type: "dartbot",
        name: "DartBot",
        level: 10,
      });
    }
  });

  it("rejects dartbot player with level 0", () => {
    const result = validateFiveOhOneSettings({
      matchMode: "first-to",
      targetCount: 3,
      unit: "legs",
      players: [
        userPlayer,
        { id: "db1", type: "dartbot", name: "DartBot", level: 0 },
      ],
    });
    expect(result).toEqual({
      valid: false,
      code: MessageCode.INVALID_GAME_SETTINGS,
    });
  });
});

describe("validateVisitScore", () => {
  it("accepts 0–180", () => {
    expect(validateVisitScore(60)).toEqual({ valid: true, value: 60 });
  });

  it("rejects out of range", () => {
    expect(validateVisitScore(181).valid).toBe(false);
  });
});
