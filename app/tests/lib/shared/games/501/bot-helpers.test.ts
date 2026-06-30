import { describe, expect, it } from "vitest";
import {
  applyVisit,
  buildFiveOhOneSession,
  canUndoDartBotPair,
  canUndoUserCheckoutBeforeBotLegStart,
  getOpponentPlayer,
  isDartBotSession,
  isDartBotTurn,
  lastTwoVisitsAreUserThenDartBot,
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

const guestSettings = {
  matchMode: "first-to" as const,
  targetCount: 1,
  unit: "legs" as const,
  players: [
    { id: "u1", type: "user" as const, name: "Levi" },
    { id: "g1", type: "guest" as const, name: "Guest" },
  ],
};

describe("bot-helpers", () => {
  it("returns opponent player in two player session", () => {
    const session = buildFiveOhOneSession(botSettings, "u1");

    const opponent = getOpponentPlayer(session, "u1");

    expect(opponent?.id).toBe("b1");
  });

  it("detects dartbot sessions", () => {
    const botSession = buildFiveOhOneSession(botSettings, "u1");
    const guestSession = buildFiveOhOneSession(guestSettings, "u1");

    expect(isDartBotSession(botSession)).toBe(true);
    expect(isDartBotSession(guestSession)).toBe(false);
  });

  it("detects dartbot turn from current player", () => {
    const session = buildFiveOhOneSession(botSettings, "u1");
    session.state.phase = "play";
    session.state.currentPlayerId = "b1";

    expect(isDartBotTurn(session)).toBe(true);
  });

  it("detects last two visits as user then dartbot", () => {
    const session = buildFiveOhOneSession(botSettings, "u1");
    session.state.phase = "play";
    const afterUser = applyVisit(session, 60);
    const afterBot = applyVisit(afterUser, 45);

    expect(lastTwoVisitsAreUserThenDartBot(afterBot)).toBe(true);
  });

  it("allows undo only when user turn follows a user+dartbot pair", () => {
    const session = buildFiveOhOneSession(botSettings, "u1");
    session.state.phase = "play";
    const afterUser = applyVisit(session, 60, { botRngBefore: 99 });
    const afterBot = applyVisit(afterUser, 45);

    expect(canUndoDartBotPair(afterBot)).toBe(true);
    expect(canUndoDartBotPair(afterUser)).toBe(false);
  });

  it("allows undo after user leg checkout before bot starts next leg", () => {
    const session = buildFiveOhOneSession(
      {
        ...botSettings,
        targetCount: 2,
      },
      "u1",
    );
    session.state.phase = "play";
    session.state.players[0]!.remaining = 40;
    session.state.currentPlayerId = "u1";

    const afterCheckout = applyVisit(session, 40);

    expect(isDartBotTurn(afterCheckout)).toBe(true);
    expect(afterCheckout.visitHistory.at(-1)?.checkout).toBe(true);
    expect(canUndoUserCheckoutBeforeBotLegStart(afterCheckout)).toBe(true);
  });

  it("disallows checkout undo when it is not bot turn", () => {
    const session = buildFiveOhOneSession(
      {
        ...botSettings,
        targetCount: 2,
      },
      "u1",
    );
    session.state.phase = "play";
    session.state.players[0]!.remaining = 40;
    session.state.currentPlayerId = "u1";

    const afterCheckout = applyVisit(session, 40);
    afterCheckout.state.currentPlayerId = "u1";

    expect(canUndoUserCheckoutBeforeBotLegStart(afterCheckout)).toBe(false);
  });

  it("disallows checkout undo when last visit is not a checkout", () => {
    const session = buildFiveOhOneSession(botSettings, "u1");
    session.state.phase = "play";
    const afterUser = applyVisit(session, 60);
    const afterBot = applyVisit(afterUser, 45);

    expect(canUndoUserCheckoutBeforeBotLegStart(afterBot)).toBe(false);
  });
});
