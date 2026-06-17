import { STARTING_TARGET } from "@lib/shared/games/ten-up-one-down/constants";
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";
import type { TenUpOneDownGameState } from "@lib/shared/games/ten-up-one-down/session";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";
import { resolveTargetAfterRound } from "@lib/shared/games/ten-up-one-down/target";

export function createInitialGameState(_settings: TenUpOneDownSettings): TenUpOneDownGameState {
  return {
    currentRound: 1,
    currentTarget: STARTING_TARGET,
    status: "active",
    lastAdjustment: null,
  };
}

export function applyRoundToState(
  state: TenUpOneDownGameState,
  round: TenUpOneDownRoundRecord,
  settings: TenUpOneDownSettings
): TenUpOneDownGameState {
  const { target, completedOn170 } = resolveTargetAfterRound(round.targetAtStart, round.finished);
  round.targetAfter = target;

  let status = state.status;
  let currentRound = state.currentRound + 1;

  if (completedOn170) {
    status = "completed";
  } else if (settings.endMode === "rounds" && currentRound > settings.roundCount) {
    status = "completed";
  }

  return {
    currentRound,
    currentTarget: target,
    status,
    lastAdjustment: round.finished ? "success" : "failure",
  };
}

export function revertRoundFromState(
  state: TenUpOneDownGameState,
  removedRound: TenUpOneDownRoundRecord
): TenUpOneDownGameState {
  return {
    currentRound: state.currentRound - 1,
    currentTarget: removedRound.targetAtStart,
    status: state.status === "completed" ? "active" : state.status,
    lastAdjustment: null,
  };
}
