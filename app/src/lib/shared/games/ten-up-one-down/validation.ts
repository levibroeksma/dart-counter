import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  MIN_ROUND_COUNT, MAX_ROUND_COUNT,
  MIN_PLAYTIME_SECONDS, MAX_PLAYTIME_SECONDS,
} from "@lib/shared/games/ten-up-one-down/constants";
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";

export type ValidateSettingsResult =
  | { valid: true; value: TenUpOneDownSettings }
  | { valid: false; code: typeof MessageCode.INVALID_GAME_SETTINGS };

export function validateTenUpOneDownSettings(
  raw: Record<string, unknown>
): ValidateSettingsResult {
  const endMode = raw.endMode;
  if (endMode === "rounds") {
    const roundCount = Number(raw.roundCount);
    if (!Number.isInteger(roundCount) || roundCount < MIN_ROUND_COUNT || roundCount > MAX_ROUND_COUNT) {
      return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
    }
    return { valid: true, value: { endMode: "rounds", roundCount } };
  }
  if (endMode === "timed") {
    const playtimeSeconds = Number(raw.playtimeSeconds);
    if (!Number.isInteger(playtimeSeconds) || playtimeSeconds < MIN_PLAYTIME_SECONDS || playtimeSeconds > MAX_PLAYTIME_SECONDS) {
      return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
    }
    return { valid: true, value: { endMode: "timed", playtimeSeconds } };
  }
  return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
}
