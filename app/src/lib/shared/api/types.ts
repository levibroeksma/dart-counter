import type { MessageCode } from "@lib/shared/constants/errors.constants";
import type { GameConfig, GameType } from "@lib/shared/games/types";
import type { FiveOhOneSummary } from "@lib/shared/games/501";
import type {
  ScoreTrainingSession,
  ScoreTrainingSummary,
} from "@lib/shared/games/score-training";
import type { SinglesTrainingSummary } from "@lib/shared/games/singles-training";
import type { TenUpOneDownSummary } from "@lib/shared/games/ten-up-one-down";

export type PreferencesSuccess = { ok: true; displayName?: string };
export type GamesCatalogSuccess = { ok: true; games: GameType[] };
export type GameConfigSuccess = { ok: true; config: GameConfig };
export type ScoreTrainingSessionSuccess = {
  ok: true;
  session: ScoreTrainingSession;
  completed?: boolean;
  summary?: ScoreTrainingSummary;
};
export type ScoreTrainingCompleteSuccess = {
  ok: true;
  summary: ScoreTrainingSummary;
};
export type FiveOhOneCompleteSuccess = {
  ok: true;
  summary: FiveOhOneSummary;
};
export type SinglesTrainingCompleteSuccess = {
  ok: true;
  summary: SinglesTrainingSummary;
};
export type TenUpOneDownCompleteSuccess = {
  ok: true;
  summary: TenUpOneDownSummary;
};
export type ApiSuccess =
  | { ok: true }
  | PreferencesSuccess
  | GamesCatalogSuccess
  | GameConfigSuccess
  | ScoreTrainingSessionSuccess
  | ScoreTrainingCompleteSuccess
  | FiveOhOneCompleteSuccess
  | SinglesTrainingCompleteSuccess
  | TenUpOneDownCompleteSuccess;
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
