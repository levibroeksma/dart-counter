import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  MAX_TARGET_COUNT_LEGS,
  MAX_TARGET_COUNT_SETS,
  MAX_VISIT_SCORE,
  MIN_TARGET_COUNT_LEGS,
  MIN_TARGET_COUNT_SETS,
  MIN_VISIT_SCORE,
} from "@lib/shared/games/501/constants";
import type {
  FiveOhOnePlayer,
  FiveOhOneSettings,
} from "@lib/shared/games/501/settings";

export type ValidateSettingsResult =
  | { valid: true; value: FiveOhOneSettings }
  | { valid: false; code: typeof MessageCode.INVALID_GAME_SETTINGS };

export type ValidateVisitScoreResult =
  | { valid: true; value: number }
  | { valid: false; code: typeof MessageCode.INVALID_SCORE };

function isValidUserOrGuestPlayer(raw: unknown): raw is FiveOhOnePlayer {
  if (!raw || typeof raw !== "object") return false;
  const p = raw as FiveOhOnePlayer;
  return (
    typeof p.id === "string" &&
    (p.type === "user" || p.type === "guest") &&
    typeof p.name === "string" &&
    p.name.trim().length > 0
  );
}

function isValidDartbotPlayer(raw: unknown): raw is FiveOhOnePlayer {
  if (!raw || typeof raw !== "object") return false;
  const p = raw as FiveOhOnePlayer;
  return (
    typeof p.id === "string" &&
    p.type === "dartbot" &&
    p.name === "DartBot" &&
    Number.isInteger(p.level) &&
    p.level >= 1 &&
    p.level <= 15
  );
}

function isValidPlayer(raw: unknown): raw is FiveOhOnePlayer {
  return isValidUserOrGuestPlayer(raw) || isValidDartbotPlayer(raw);
}

export function validateFiveOhOneSettings(
  raw: Record<string, unknown>,
): ValidateSettingsResult {
  const matchMode = raw.matchMode;
  const unit = raw.unit;
  const targetCount = Number(raw.targetCount);
  const playersRaw = raw.players;

  if (matchMode !== "best-of" && matchMode !== "first-to") {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }
  if (unit !== "legs" && unit !== "sets") {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const [minCount, maxCount] =
    unit === "legs"
      ? [MIN_TARGET_COUNT_LEGS, MAX_TARGET_COUNT_LEGS]
      : [MIN_TARGET_COUNT_SETS, MAX_TARGET_COUNT_SETS];

  if (
    !Number.isInteger(targetCount) ||
    targetCount < minCount ||
    targetCount > maxCount
  ) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  if (
    !Array.isArray(playersRaw) ||
    playersRaw.length < 1 ||
    playersRaw.length > 2
  ) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  const players: FiveOhOnePlayer[] = [];
  for (const p of playersRaw) {
    if (!isValidPlayer(p)) {
      return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
    }
    if (p.type === "dartbot") {
      players.push(p);
    } else {
      players.push({ ...p, name: p.name.trim() });
    }
  }

  if (!players.some((p) => p.type === "user")) {
    return { valid: false, code: MessageCode.INVALID_GAME_SETTINGS };
  }

  return {
    valid: true,
    value: { matchMode, targetCount, unit, players },
  };
}

export function validateVisitScore(value: unknown): ValidateVisitScoreResult {
  const score = Number(value);
  if (
    !Number.isInteger(score) ||
    score < MIN_VISIT_SCORE ||
    score > MAX_VISIT_SCORE
  ) {
    return { valid: false, code: MessageCode.INVALID_SCORE };
  }
  return { valid: true, value: score };
}
