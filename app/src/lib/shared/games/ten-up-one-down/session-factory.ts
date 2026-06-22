import { createInitialGameState } from "@lib/shared/games/ten-up-one-down/state";
import type { TenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session";
import type { TenUpOneDownSettings } from "@lib/shared/games/ten-up-one-down/settings";

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
