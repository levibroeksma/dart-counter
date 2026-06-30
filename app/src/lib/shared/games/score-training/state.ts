import { STARTING_SCORE } from "./constants";
import type {
  ScoreTrainingGameState,
  ScoreTrainingRoundRecord,
  ScoreTrainingSettings,
} from "./types";

export function createInitialGameState(_settings: ScoreTrainingSettings): ScoreTrainingGameState {
  return {
    currentRound: 1,
    currentScore: STARTING_SCORE,
    status: "active",
    lastScore: null,
  };
}

export function applyRoundToState(
  state: ScoreTrainingGameState,
  round: ScoreTrainingRoundRecord,
  settings: ScoreTrainingSettings,
  timerExpired = false,
): ScoreTrainingGameState {
  const nextRound = state.currentRound + 1;
  let status = state.status;

  if (settings.endMode === "rounds" && nextRound > settings.roundCount) {
    status = "completed";
  } else if (settings.endMode === "timed" && timerExpired) {
    status = "completed";
  }

  return {
    currentRound: nextRound,
    currentScore: round.runningTotal,
    lastScore: round.visitScore,
    status,
  };
}

export function revertRoundFromState(
  state: ScoreTrainingGameState,
  removedRound: ScoreTrainingRoundRecord,
  previousLastScore: number | null,
): ScoreTrainingGameState {
  return {
    currentRound: state.currentRound - 1,
    currentScore: removedRound.runningTotal - removedRound.visitScore,
    lastScore: previousLastScore,
    status: state.status === "completed" ? "active" : state.status,
  };
}

export function isGameComplete(
  state: ScoreTrainingGameState,
  settings: ScoreTrainingSettings,
  timerExpired: boolean,
): boolean {
  if (state.status === "completed") return true;
  if (settings.endMode === "rounds" && state.currentRound > settings.roundCount) return true;
  if (settings.endMode === "timed" && timerExpired) return true;
  return false;
}
