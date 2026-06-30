import { describe, expect, it } from "vitest";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  applyVisit,
  buildFiveOhOneSession,
  validateCompletedFiveOhOneSession,
} from "@lib/shared/games/501";

const botSettings = {
  matchMode: "first-to" as const,
  targetCount: 1,
  unit: "legs" as const,
  players: [
    { id: "u1", type: "user" as const, name: "Levi" },
    { id: "b1", type: "dartbot" as const, name: "DartBot" as const, level: 10 },
  ],
};

function buildCompletedDartBotSession() {
  let session = buildFiveOhOneSession(botSettings, "u1");

  for (const score of [180, 180, 180, 180, 141]) {
    session = applyVisit(session, score);
  }

  session.botState!.rngState = 999999;
  return session;
}

function buildCompletedDartBotSessionWithBotRng() {
  let session = buildFiveOhOneSession(botSettings, "u1");
  session.state.phase = "play";

  const visits: Array<{ score: number; botRngBefore?: number }> = [
    { score: 180, botRngBefore: 100 },
    { score: 180 },
    { score: 180, botRngBefore: 200 },
    { score: 180 },
    { score: 141, botRngBefore: 300 },
  ];

  for (const visit of visits) {
    session = applyVisit(
      session,
      visit.score,
      visit.botRngBefore !== undefined
        ? { botRngBefore: visit.botRngBefore }
        : undefined,
    );
  }

  session.botState!.rngState = 999999;
  return session;
}

function buildCompletedSession() {
  let session = buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 1,
    unit: "legs",
    players: [{ id: "u1", type: "user", name: "Levi" }],
  });

  for (const score of [180, 180, 141]) {
    session = applyVisit(session, score);
  }

  return session;
}

describe("validateCompletedFiveOhOneSession", () => {
  it("accepts a legitimately completed session", () => {
    const session = buildCompletedSession();
    const result = validateCompletedFiveOhOneSession(session);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.state.status).toBe("completed");
    }
  });

  it("rejects incomplete session", () => {
    const session = buildFiveOhOneSession({
      matchMode: "first-to",
      targetCount: 1,
      unit: "legs",
      players: [{ id: "u1", type: "user", name: "Levi" }],
    });

    const result = validateCompletedFiveOhOneSession(session);
    expect(result).toEqual({
      valid: false,
      code: MessageCode.GAME_NOT_COMPLETE,
    });
  });

  it("rejects tampered visit history", () => {
    const session = buildCompletedSession();
    session.visitHistory[0]!.remainingAfter = 999;

    const result = validateCompletedFiveOhOneSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_SCORE });
  });

  it("replays completed dartbot session ignoring botState", () => {
    const session = buildCompletedDartBotSession();
    const result = validateCompletedFiveOhOneSession(session);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.state.status).toBe("completed");
    }
  });

  it("validates completed dartbot session with botRngBefore on user visits", () => {
    const session = buildCompletedDartBotSessionWithBotRng();
    const result = validateCompletedFiveOhOneSession(session);

    expect(result.valid).toBe(true);
  });

  it("rejects invalid shape", () => {
    const result = validateCompletedFiveOhOneSession({
      slug: "score-training",
    });
    expect(result).toEqual({
      valid: false,
      code: MessageCode.INVALID_GAME_SETTINGS,
    });
  });
});
