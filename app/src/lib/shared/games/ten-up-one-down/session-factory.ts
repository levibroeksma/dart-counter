import { createInitialGameState } from "./state";
import type { TenUpOneDownSession, TenUpOneDownSettings } from "./types";

export function buildTenUpOneDownSession(settings: TenUpOneDownSettings): TenUpOneDownSession {
  const now = new Date().toISOString();
  return {
    slug: "ten-up-one-down",
    settings,
    state: createInitialGameState(settings),
    roundHistory: [],
    timeRemainingSeconds: settings.endMode === "timed" ? settings.playtimeSeconds : null,
    createdAt: now,
    updatedAt: now,
  };
}
