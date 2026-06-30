import { describe, it, expect } from "vitest";
import { STARTING_SCORE } from "@lib/shared/games/501/constants";
import { buildFiveOhOneSession } from "@lib/shared/games/501/session-factory";

const settings1P = {
  matchMode: "best-of" as const,
  targetCount: 3,
  unit: "legs" as const,
  players: [{ id: "u1", type: "user" as const, name: "Levi" }],
};

describe("buildFiveOhOneSession", () => {
  it("builds 1P session in play phase with user as current player", () => {
    const session = buildFiveOhOneSession(settings1P);
    expect(session.slug).toBe("501");
    expect(session.state.phase).toBe("play");
    expect(session.state.currentPlayerId).toBe("u1");
    expect(session.state.players[0].remaining).toBe(STARTING_SCORE);
  });

  it("builds 2P session in starter phase", () => {
    const session = buildFiveOhOneSession({
      ...settings1P,
      players: [
        { id: "u1", type: "user", name: "Levi" },
        { id: "g1", type: "guest", name: "Guest" },
      ],
    });
    expect(session.state.phase).toBe("starter");
    expect(session.state.players).toHaveLength(2);
  });

  it("initializes botState when dartbot opponent present", () => {
    const session = buildFiveOhOneSession({
      matchMode: "best-of",
      targetCount: 3,
      unit: "legs",
      players: [
        { id: "u1", type: "user", name: "Levi" },
        { id: "b1", type: "dartbot", name: "DartBot", level: 10 },
      ],
    });
    expect(session.botState).toBeDefined();
    expect(session.botState!.matchPlan.legTargets.length).toBe(3);
    expect(session.botState!.currentLegIndex).toBe(0);
    expect(typeof session.botState!.rngState).toBe("number");
  });

  it("omits botState for guest-only 2P", () => {
    const session = buildFiveOhOneSession({
      matchMode: "best-of",
      targetCount: 3,
      unit: "legs",
      players: [
        { id: "u1", type: "user", name: "Levi" },
        { id: "g1", type: "guest", name: "Guest" },
      ],
    });
    expect(session.botState).toBeUndefined();
  });
});
