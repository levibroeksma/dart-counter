import type { MessageCode } from "@lib/shared/constants/errors.constants";
import type { GameConfig, GameType } from "@lib/shared/games/types";

export type PreferencesSuccess = { ok: true; displayName?: string };
export type GamesCatalogSuccess = { ok: true; games: GameType[] };
export type GameConfigSuccess = { ok: true; config: GameConfig };
export type ApiSuccess =
  | { ok: true }
  | PreferencesSuccess
  | GamesCatalogSuccess
  | GameConfigSuccess;
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
