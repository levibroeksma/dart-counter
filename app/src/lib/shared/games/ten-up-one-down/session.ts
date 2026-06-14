import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

export type TenUpOneDownGameStatus = "active" | "paused" | "completed";

export type TenUpOneDownGameState = {
  currentRound: number;
  currentTarget: number;
  status: TenUpOneDownGameStatus;
  lastAdjustment: "success" | "failure" | null;
};

export type TenUpOneDownSession = {
  slug: "ten-up-one-down";
  settings: TenUpOneDownSettings;
  state: TenUpOneDownGameState;
  roundHistory: TenUpOneDownRoundRecord[];
  timeRemainingSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};
