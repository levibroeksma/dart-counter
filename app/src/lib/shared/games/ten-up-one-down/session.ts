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

/**
 * Runtime guard for persisted session documents (rejects legacy config-only shapes).
 */
export function isTenUpOneDownSession(value: unknown): value is TenUpOneDownSession {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  const state = record.state;

  return (
    record.slug === "ten-up-one-down" &&
    state !== null &&
    typeof state === "object" &&
    typeof (state as TenUpOneDownGameState).currentTarget === "number" &&
    Array.isArray(record.roundHistory) &&
    record.settings !== null &&
    typeof record.settings === "object"
  );
}
