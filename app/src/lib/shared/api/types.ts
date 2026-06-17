import type { MessageCode } from "@lib/shared/constants/errors.constants";
import type { GameConfig, GameType } from "@lib/shared/games/types";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";

export type PreferencesSuccess = { ok: true; displayName?: string };
export type GamesCatalogSuccess = { ok: true; games: GameType[] };
export type GameConfigSuccess = { ok: true; config: GameConfig };
export type TenUpOneDownSessionSuccess = {
  ok: true;
  session: TenUpOneDownSession;
  completed?: boolean;
};
export type ApiSuccess =
  | { ok: true }
  | PreferencesSuccess
  | GamesCatalogSuccess
  | GameConfigSuccess
  | TenUpOneDownSessionSuccess;
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
