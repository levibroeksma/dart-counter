import { describe, expect, it } from "vitest";
import { buildFiveOhOneSession } from "@lib/shared/games/501/session-factory";
import { simulateDartBotVisitForSession } from "@lib/shared/games/501/bot-play";
import { deepClone } from "@lib/shared/utils/deep-clone";

function buildDartBotSession() {
  const session = buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 3,
    unit: "legs",
    players: [
      { id: "u1", type: "user", name: "Levi" },
      { id: "b1", type: "dartbot", name: "DartBot", level: 6 },
    ],
  });
  session.state.phase = "play";
  session.state.currentPlayerId = "b1";
  session.state.legStartingPlayerId = "u1";
  return session;
}

describe("simulateDartBotVisitForSession", () => {
  it("simulates deterministically from the same session state", () => {
    const session = buildDartBotSession();

    const first = simulateDartBotVisitForSession(deepClone(session));
    const replay = simulateDartBotVisitForSession(deepClone(session));

    expect(first.visit).toEqual(replay.visit);
    expect(first.session.botState?.rngState).toBe(replay.session.botState?.rngState);
  });

  it("extends leg targets when current leg index exceeds plan length", () => {
    const session = buildDartBotSession();
    if (!session.botState) throw new Error("Expected botState for dartbot session");
    session.botState.currentLegIndex = session.botState.matchPlan.legTargets.length;

    const result = simulateDartBotVisitForSession(session);

    expect(result.session.botState?.matchPlan.legTargets.length).toBeGreaterThan(
      session.botState.matchPlan.legTargets.length,
    );
  });
});
