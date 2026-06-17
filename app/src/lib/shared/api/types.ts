import type { MessageCode } from "@lib/shared/constants/errors.constants";
import type { GameConfig, GameType } from "@lib/shared/games/types";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";
import type { ScoreTrainingSummary } from "@lib/shared/games/score-training/summary";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";

export type PreferencesSuccess = { ok: true; displayName?: string };
export type GamesCatalogSuccess = { ok: true; games: GameType[] };
export type GameConfigSuccess = { ok: true; config: GameConfig };
export type TenUpOneDownSessionSuccess = {
  ok: true;
  session: TenUpOneDownSession;
  completed?: boolean;
};
export type ScoreTrainingSessionSuccess = {
  ok: true;
  session: ScoreTrainingSession;
  completed?: boolean;
  summary?: ScoreTrainingSummary;
};
export type ApiSuccess =
  | { ok: true }
  | PreferencesSuccess
  | GamesCatalogSuccess
  | GameConfigSuccess
  | TenUpOneDownSessionSuccess
  | ScoreTrainingSessionSuccess;
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
