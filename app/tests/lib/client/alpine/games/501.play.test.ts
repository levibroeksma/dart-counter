// @vitest-environment jsdom

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import Alpine from "alpinejs";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  FIVE_OH_ONE_SESSION_KEY,
  clearPersistedFiveOhOneSession,
  fiveOhOnePlay,
} from "@lib/client/alpine/games/501.play";
import {
  applyVisit,
  buildFiveOhOneSession,
  buildSummary,
  type FiveOhOneSession,
} from "@lib/shared/games/501";

beforeAll(() => {
  (Alpine as unknown as Record<string, unknown>).$persist = (
    value: unknown,
  ) => ({
    as: (_key: string) => ({
      using: (_storage: Storage) =>
        value && typeof value === "object"
          ? new Proxy(value as object, {
              get(target, prop, receiver) {
                const result = Reflect.get(target, prop, receiver);
                if (result && typeof result === "object") {
                  return new Proxy(result, {});
                }
                return result;
              },
            })
          : value,
    }),
  });
});

const onePlayerSettings = {
  matchMode: "first-to" as const,
  targetCount: 1,
  unit: "legs" as const,
  players: [{ id: "u1", type: "user" as const, name: "Levi" }],
};

function buildOnePlayerSession(): FiveOhOneSession {
  return buildFiveOhOneSession(onePlayerSettings);
}

function buildTwoPlayerStarterSession(): FiveOhOneSession {
  return buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 1,
    unit: "legs",
    players: [
      { id: "u1", type: "user", name: "Levi" },
      { id: "g1", type: "guest", name: "Guest" },
    ],
  });
}

function buildDartBotStarterSession(): FiveOhOneSession {
  return buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 1,
    unit: "legs",
    players: [
      { id: "u1", type: "user", name: "Levi" },
      { id: "b1", type: "dartbot", name: "DartBot", level: 8 },
    ],
  });
}

function buildDartBotPlaySession(): FiveOhOneSession {
  const session = buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 1,
    unit: "legs",
    players: [
      { id: "u1", type: "user", name: "Levi" },
      { id: "b1", type: "dartbot", name: "DartBot", level: 8 },
    ],
  });
  session.state.phase = "play";
  session.state.currentPlayerId = "u1";
  return session;
}

describe("fiveOhOnePlay", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("init redirects when session is missing", () => {
    const play = fiveOhOnePlay(null);

    play.init();

    expect(window.location.href).toBe("/games/settings-501");
    expect(play.ready).toBe(false);
  });

  it("selectStarter sets starter and moves phase to play", () => {
    const play = fiveOhOnePlay(buildTwoPlayerStarterSession());
    play.init();

    play.selectStarter("g1");

    expect(play.session?.state.phase).toBe("play");
    expect(play.session?.state.currentPlayerId).toBe("g1");
    expect(play.session?.state.legStartingPlayerId).toBe("g1");
  });

  it("selectStarter auto-plays dartbot after delay when bot starts", async () => {
    vi.useFakeTimers();
    const play = fiveOhOnePlay(buildDartBotStarterSession());
    const runSpy = vi.spyOn(play, "runDartBotTurn").mockResolvedValue();
    play.ready = true;

    play.selectStarter("b1");

    expect(play.session?.state.currentPlayerId).toBe("b1");
    expect(play.botTurnActive).toBe(true);
    expect(runSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(runSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("submitVisit ignores manual input while dartbot is current player", async () => {
    const settings = buildDartBotStarterSession().settings;
    const play = fiveOhOnePlay(buildFiveOhOneSession(settings, "b1"));
    vi.spyOn(play, "runDartBotTurn").mockResolvedValue();
    play.init();
    play.botTurnActive = false;
    play.score = "60";

    await play.submitVisit();

    expect(play.session?.visitHistory).toHaveLength(0);
  });

  it("submitVisit applies visit locally without fetch", () => {
    const play = fiveOhOnePlay(buildOnePlayerSession());
    play.init();
    play.score = "60";

    play.submitVisit();

    expect(fetch).not.toHaveBeenCalled();
    expect(play.session?.visitHistory).toHaveLength(1);
    expect(play.session?.state.players[0]?.remaining).toBe(441);
    expect(play.score).toBeNull();
  });

  it("submitVisit treats empty score as zero and applies visit", async () => {
    const play = fiveOhOnePlay(buildOnePlayerSession());
    play.init();
    play.score = null;

    await play.submitVisit();

    expect(play.session?.visitHistory).toHaveLength(1);
    expect(play.session?.visitHistory[0]?.visitScore).toBe(0);
    expect(play.session?.state.players[0]?.remaining).toBe(501);
  });

  it("submitVisit defers applyVisit when checkout modal is required", async () => {
    const session = buildOnePlayerSession();
    session.state.players[0]!.remaining = 40;
    const play = fiveOhOnePlay(session);
    play.init();
    play.score = "20";

    await play.submitVisit();

    expect(play.session?.visitHistory).toHaveLength(0);
    expect(play.showModal).toBe(true);
    expect(play.modalKind).toBe("partial");
    expect(play.pendingVisitScore).toBe(20);
  });

  it("undoVisit reverts user + dartbot pair in dartbot sessions", () => {
    const play = fiveOhOnePlay(buildDartBotPlaySession());
    play.init();
    if (!play.session?.botState) throw new Error("Expected bot state");
    const rngBefore = play.session.botState.rngState;

    play.session = applyVisit(play.session, 60, { botRngBefore: rngBefore });
    play.session = applyVisit(play.session, 45);
    if (!play.session.botState) throw new Error("Expected bot state");
    play.session.botState.rngState = rngBefore + 99;

    play.undoVisit();

    expect(play.session.visitHistory).toHaveLength(0);
    expect(play.session.botState?.rngState).toBe(rngBefore);
  });

  it("completeMatch builds local summary before persist and sets persisting", () => {
    const session = buildOnePlayerSession();
    session.state.players[0]!.remaining = 40;
    const completedSession = applyVisit(session, 40);
    const expectedSummary = buildSummary(completedSession);
    let resolveFetch!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const play = fiveOhOnePlay(completedSession);
    play.init();

    play.completeMatch();

    expect(play.showSummary).toBe(true);
    expect(play.persisting).toBe(true);
    expect(play.summary).toEqual(expectedSummary);

    resolveFetch({
      json: async () => ({ ok: true, summary: expectedSummary }),
    } as Response);
  });

  it("persistCompletion clears persisted session on success and resets persisting", async () => {
    const session = buildOnePlayerSession();
    session.state.players[0]!.remaining = 40;
    const completedSession = applyVisit(session, 40);
    const expectedSummary = buildSummary(completedSession);
    sessionStorage.setItem(Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY), "{}");
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true, summary: expectedSummary }),
    } as Response);

    const play = fiveOhOnePlay(completedSession);
    play.init();
    play.persisting = true;
    await play.persistCompletion();

    expect(play.persisting).toBe(false);
    expect(
      sessionStorage.getItem(Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY)),
    ).toBeNull();
  });

  it("persistCompletion resets persisting when API returns error", async () => {
    const play = fiveOhOnePlay(buildOnePlayerSession());
    play.init();
    play.persisting = true;
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: false, code: MessageCode.SERVER_ERROR }),
    } as Response);

    await play.persistCompletion();

    expect(play.persisting).toBe(false);
    expect(play.error.length).toBeGreaterThan(0);
  });

  it("persistCompletion resets persisting on network failure", async () => {
    const play = fiveOhOnePlay(buildOnePlayerSession());
    play.init();
    play.persisting = true;
    vi.mocked(fetch).mockRejectedValue(new Error("network"));

    await play.persistCompletion();

    expect(play.persisting).toBe(false);
    expect(play.error.length).toBeGreaterThan(0);
  });

  it("blocks playAgain and back while persisting", () => {
    const play = fiveOhOnePlay(buildOnePlayerSession());
    play.init();
    play.showSummary = true;
    play.summary = buildSummary(play.session!);
    play.persisting = true;

    play.playAgain();
    play.backToGames();

    expect(play.showSummary).toBe(true);
    expect(window.location.href).toBe("");
  });

  it("clearPersistedFiveOhOneSession removes persisted session", () => {
    sessionStorage.setItem(Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY), "{}");

    clearPersistedFiveOhOneSession();

    expect(
      sessionStorage.getItem(Alpine.prefixed(FIVE_OH_ONE_SESSION_KEY)),
    ).toBeNull();
  });
});
