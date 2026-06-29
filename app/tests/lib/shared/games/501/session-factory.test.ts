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
});
