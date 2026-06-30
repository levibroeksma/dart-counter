import {
  createEmptySetRunningStats,
  createRng,
  generateMatchPlan,
  getSkillProfile,
  hashSeed,
} from "@lib/shared/dartbot";
import { STARTING_SCORE } from "./constants";
import { estimateLegCount } from "./leg-estimate";
import type { FiveOhOneSession, FiveOhOneSettings } from "./types";

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

function findDartBot(settings: FiveOhOneSettings) {
  return settings.players.find((p) => p.type === "dartbot");
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

  const session: FiveOhOneSession = {
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

  const dartbot = findDartBot(settings);
  if (dartbot && dartbot.type === "dartbot") {
    const seed = hashSeed(now, dartbot.level);
    const skill = getSkillProfile(Math.min(10, dartbot.level));
    const legCount = estimateLegCount(settings);
    const matchPlan = generateMatchPlan(skill, legCount, seed);
    const rng = createRng(seed);
    session.botState = {
      matchPlan: {
        legTargets: matchPlan.legTargets,
        skill: matchPlan.skill,
        seed: matchPlan.seed,
      },
      rngState: rng.getState(),
      currentLegIndex: 0,
      setRunningStats: createEmptySetRunningStats(),
      setNumber: 1,
    };
  }

  return session;
}
