import { STARTING_SCORE } from "@lib/shared/games/501/constants";
import type { FiveOhOneSettings } from "@lib/shared/games/501/settings";
import type { FiveOhOneSession } from "@lib/shared/games/501/session";

function createPlayerState(playerId: string) {
  return {
    playerId,
    remaining: STARTING_SCORE,
    dartsThisLeg: 0,
    lastVisitScore: null,
    legsWonInSet: 0,
    setsWon: 0,
    totalLegsWon: 0,
  };
}

/**
 * Builds a new 501 session from validated settings.
 */
export function buildFiveOhOneSession(
  settings: FiveOhOneSettings,
  startingPlayerId?: string,
): FiveOhOneSession {
  const isTwoPlayer = settings.players.length === 2;
  const defaultStarter = settings.players[0]!.id;
  const starterId = startingPlayerId ?? defaultStarter;
  const now = new Date().toISOString();

  return {
    slug: "501",
    settings,
    visitHistory: [],
    createdAt: now,
    updatedAt: now,
    state: {
      status: "active",
      phase: isTwoPlayer && !startingPlayerId ? "starter" : "play",
      currentPlayerId:
        isTwoPlayer && !startingPlayerId ? defaultStarter : starterId,
      currentLeg: 1,
      currentSet: 1,
      players: settings.players.map((p) => createPlayerState(p.id)),
      scoreAtVisitStart: STARTING_SCORE,
      legStartingPlayerId: starterId,
    },
  };
}
