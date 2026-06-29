// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Alpine from "alpinejs";
import {
  tenUpOneDownPlay,
  TEN_UP_ONE_DOWN_SESSION_KEY,
  clearPersistedTenUpOneDownSession,
} from "@lib/client/alpine/games/ten-up-one-down.play";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";

/**
 * Mock Alpine.$persist to return the initial value directly so unit tests
 * can exercise the controller logic without Alpine's full reactive lifecycle.
 */
beforeAll(() => {
  (Alpine as unknown as Record<string, unknown>).$persist = (value: unknown) => ({
    as: (_key: string) => ({ using: (_storage: Storage) => value }),
  });
});

const roundsSession = {
  slug: "ten-up-one-down" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: {
    currentRound: 1,
    currentTarget: 41,
    status: "active" as const,
    lastAdjustment: null,
  },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

const timedSession = {
  ...roundsSession,
  settings: { endMode: "timed" as const, playtimeSeconds: 60 },
  timeRemainingSeconds: 60,
};

describe("tenUpOneDownPlay", () => {
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("starts with ready false, sets ready true after init", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    expect(play.ready).toBe(false);
    play.init();
    expect(play.ready).toBe(true);
  });

  it("redirects to settings when no server session and no persisted session", () => {
    const play = tenUpOneDownPlay(null);
    play.init();
    expect(window.location.href).toBe("/games/settings-ten-up-one-down");
    expect(play.ready).toBe(false);
  });

  it("redirects to settings when session is already completed", () => {
    const completedSession = {
      ...structuredClone(roundsSession),
      state: { ...roundsSession.state, status: "completed" as const },
    };
    const play = tenUpOneDownPlay(completedSession);
    play.init();
    expect(window.location.href).toBe("/games/settings-ten-up-one-down");
    expect(play.ready).toBe(false);
  });

  it("checkoutHintDisplay reflects current target", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.init();
    expect(play.checkoutHintDisplay).toBe("9 D16");

    play.session!.state.currentTarget = 40;
    expect(play.checkoutHintDisplay).toBe("D20");

    play.session!.state.currentTarget = 51;
    expect(play.checkoutHintDisplay).toBe("T11 D10");

    play.session!.state.currentTarget = 169;
    expect(play.checkoutHintDisplay).toBeNull();
  });

  it("submitScore opens failure modal for empty score", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.init();
    play.score = null;
    play.submitScore();
    expect(play.outcome).toBe("failure");
    expect(play.showModal).toBe(true);
    expect(play.modalQuestions.map((q) => q.id)).toEqual([
      "dartsOnDouble",
      "dartsUsed",
    ]);
  });

  it("submitScore opens success modal for matching target", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.init();
    play.score = "41";
    play.submitScore();
    expect(play.outcome).toBe("success");
    expect(play.modalQuestions[0]?.id).toBe("dartsForFinish");
  });

  it("modalCanSubmit is false when dartsOnDouble > dartsUsed on failure", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.init();
    play.submitScore();
    play.dartsOnDouble = 3;
    play.dartsUsed = 2;
    expect(play.modalCanSubmit).toBe(false);
  });

  it("modalSubmit applies round locally without round API", async () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.init();
    play.score = "41";
    play.submitScore();
    play.dartsForFinish = 2;
    play.dartsOnDouble = 1;

    await play.modalSubmit();

    expect(fetch).not.toHaveBeenCalled();
    expect(play.session?.state.currentRound).toBe(2);
    expect(play.session?.state.currentTarget).toBe(51);
    expect(play.session?.roundHistory).toHaveLength(1);
    expect(play.session?.roundHistory[0]).toEqual(
      expect.objectContaining({
        roundNumber: 1,
        targetAtStart: 41,
        finished: true,
        dartsUsed: 2,
        dartsOnDouble: 1,
      }),
    );
    expect(play.showModal).toBe(false);
    expect(play.score).toBeNull();
  });

  it("terminal round sets showSummary and calls completion fetch", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        summary: {
          completionReason: "rounds",
          roundsPlayed: 1,
          checkouts: 1,
          doubleHitPercentage: 100,
          finalTarget: 51,
          peakTarget: 51,
        },
      }),
    } as Response);

    const singleRoundSession = {
      ...structuredClone(roundsSession),
      settings: { endMode: "rounds" as const, roundCount: 1 },
    };
    const play = tenUpOneDownPlay(singleRoundSession);
    play.init();
    play.score = "41";
    play.submitScore();
    play.dartsForFinish = 2;
    play.dartsOnDouble = 1;

    await play.modalSubmit();

    expect(play.showSummary).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/games/ten-up-one-down/complete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(play.summary?.roundsPlayed).toBe(1);
  });

  it("undo reverts round locally without fetch", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.init();
    play.session!.roundHistory = [
      {
        roundNumber: 1,
        targetAtStart: 41,
        targetAfter: 51,
        finished: true,
        dartsUsed: 2,
        dartsOnDouble: 1,
      },
    ];
    play.session!.state = {
      currentRound: 2,
      currentTarget: 51,
      status: "active",
      lastAdjustment: "success",
    };

    play.undo();

    expect(fetch).not.toHaveBeenCalled();
    expect(play.session?.roundHistory).toEqual([]);
    expect(play.session?.state.currentRound).toBe(1);
    expect(play.session?.state.currentTarget).toBe(41);
  });

  it("playAgain rebuilds session without fetch", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        summary: {
          completionReason: "rounds",
          roundsPlayed: 1,
          checkouts: 1,
          doubleHitPercentage: 100,
          finalTarget: 51,
          peakTarget: 51,
        },
      }),
    } as Response);

    const play = tenUpOneDownPlay(
      buildTenUpOneDownSession({ endMode: "rounds", roundCount: 1 }),
    );
    play.init();
    play.score = "41";
    play.submitScore();
    play.dartsForFinish = 2;
    play.dartsOnDouble = 1;
    await play.modalSubmit();
    await vi.waitFor(() => expect(play.summary).not.toBeNull());

    const fetchCallsBeforePlayAgain = vi.mocked(fetch).mock.calls.length;
    play.playAgain();

    expect(vi.mocked(fetch).mock.calls.length).toBe(fetchCallsBeforePlayAgain);
    expect(play.showSummary).toBe(false);
    expect(play.summary).toBeNull();
    expect(play.score).toBeNull();
    expect(play.timerExpired).toBe(false);
    expect(play.error).toBe("");
    expect(play.session?.settings).toEqual({ endMode: "rounds", roundCount: 1 });
    expect(play.session?.state.status).toBe("active");
    expect(play.session?.roundHistory).toEqual([]);
    expect(play.session?.state.currentRound).toBe(1);
    expect(play.session?.state.currentTarget).toBe(41);
  });

  it("confirmLeave clears persist key and navigates", () => {
    sessionStorage.setItem(
      Alpine.prefixed(TEN_UP_ONE_DOWN_SESSION_KEY),
      JSON.stringify(roundsSession),
    );
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.init();
    play.confirmLeave();

    expect(sessionStorage.getItem(Alpine.prefixed(TEN_UP_ONE_DOWN_SESSION_KEY))).toBeNull();
    expect(window.location.href).toBe("/games");
  });

  it("clearPersistedTenUpOneDownSession removes session from sessionStorage", () => {
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    sessionStorage.setItem(Alpine.prefixed(TEN_UP_ONE_DOWN_SESSION_KEY), "{}");
    clearPersistedTenUpOneDownSession();
    expect(removeItem).toHaveBeenCalledWith(
      Alpine.prefixed(TEN_UP_ONE_DOWN_SESSION_KEY),
    );
    expect(sessionStorage.getItem(Alpine.prefixed(TEN_UP_ONE_DOWN_SESSION_KEY))).toBeNull();
    removeItem.mockRestore();
  });

  it("leave opens confirmation modal and confirmLeave navigates", () => {
    const open = vi.fn();
    vi.spyOn(Alpine, "store").mockReturnValue({ open });

    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.init();

    play.leave();

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith({
      title: "Leave game?",
      message: "Your progress in this session will be lost.",
      onConfirm: expect.any(Function),
    });

    const { onConfirm } = open.mock.calls[0]![0] as { onConfirm: () => void };
    onConfirm();
    expect(window.location.href).toBe("/games");
  });

  it("pauses and resumes timed countdown", () => {
    vi.useFakeTimers();
    const play = tenUpOneDownPlay(structuredClone(timedSession));

    play.init();
    vi.advanceTimersByTime(5000);
    expect(play.session!.timeRemainingSeconds).toBe(55);

    play.togglePause();
    expect(play.session!.state.status).toBe("paused");
    vi.advanceTimersByTime(5000);
    expect(play.session!.timeRemainingSeconds).toBe(55);

    play.togglePause();
    expect(play.session!.state.status).toBe("active");
    vi.advanceTimersByTime(5000);
    expect(play.session!.timeRemainingSeconds).toBe(50);
  });

  it("disables timer tick when modal is open", () => {
    const play = tenUpOneDownPlay(structuredClone(timedSession));
    play.init();
    expect(play.timerShouldTick).toBe(true);

    play.score = "41";
    play.submitScore();
    expect(play.timerShouldTick).toBe(false);
  });
});
