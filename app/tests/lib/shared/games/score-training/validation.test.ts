import { describe, it, expect } from "vitest";
import {
  validateScoreTrainingSettings,
  validateVisitScore,
} from "@lib/shared/games/score-training/validation";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("validateScoreTrainingSettings", () => {
  it("accepts rounds mode", () => {
    const result = validateScoreTrainingSettings({ endMode: "rounds", roundCount: 10 });
    expect(result).toEqual({ valid: true, value: { endMode: "rounds", roundCount: 10 } });
  });

  it("accepts timed mode", () => {
    const result = validateScoreTrainingSettings({ endMode: "timed", playtimeSeconds: 600 });
    expect(result).toEqual({ valid: true, value: { endMode: "timed", playtimeSeconds: 600 } });
  });

  it("rejects invalid round count", () => {
    const result = validateScoreTrainingSettings({ endMode: "rounds", roundCount: 0 });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });
});

describe("validateVisitScore", () => {
  it("accepts 0–180", () => {
    expect(validateVisitScore(60)).toEqual({ valid: true, value: 60 });
    expect(validateVisitScore(0)).toEqual({ valid: true, value: 0 });
    expect(validateVisitScore(180)).toEqual({ valid: true, value: 180 });
  });

  it("rejects out of range", () => {
    expect(validateVisitScore(181)).toEqual({ valid: false, code: MessageCode.INVALID_SCORE });
    expect(validateVisitScore(-1)).toEqual({ valid: false, code: MessageCode.INVALID_SCORE });
    expect(validateVisitScore(60.5)).toEqual({ valid: false, code: MessageCode.INVALID_SCORE });
  });
});
