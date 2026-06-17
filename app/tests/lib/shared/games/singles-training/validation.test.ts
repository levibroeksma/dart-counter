import { describe, it, expect } from "vitest";
import { validateSinglesTrainingSettings } from "@lib/shared/games/singles-training/validation";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  DEFAULT_DIRECTION,
  DEFAULT_MODE,
  DEFAULT_SCORING,
} from "@lib/shared/games/singles-training/constants";

describe("validateSinglesTrainingSettings", () => {
  it("accepts valid settings", () => {
    const result = validateSinglesTrainingSettings({
      direction: "random",
      mode: "extreme",
      scoring: "uniform",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.mode).toBe("extreme");
    }
  });

  it("applies defaults when fields are missing", () => {
    const result = validateSinglesTrainingSettings({});
    expect(result).toEqual({
      valid: true,
      value: {
        direction: DEFAULT_DIRECTION,
        mode: DEFAULT_MODE,
        scoring: DEFAULT_SCORING,
      },
    });
  });

  it("rejects invalid direction", () => {
    const result = validateSinglesTrainingSettings({
      direction: "sideways",
      mode: "normal",
      scoring: "traditional",
    });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });

  it("rejects invalid mode", () => {
    const result = validateSinglesTrainingSettings({
      direction: "low-to-high",
      mode: "easy",
      scoring: "traditional",
    });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });

  it("rejects invalid scoring", () => {
    const result = validateSinglesTrainingSettings({
      direction: "low-to-high",
      mode: "normal",
      scoring: "bonus",
    });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });
});
