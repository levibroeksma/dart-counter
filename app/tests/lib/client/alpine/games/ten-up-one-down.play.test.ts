// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Alpine from "alpinejs";
import { tenUpOneDownPlay } from "@lib/client/alpine/games/ten-up-one-down.play";

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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("checkoutHintDisplay reflects current target", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    expect(play.checkoutHintDisplay).toBe("9 D16");

    play.session.state.currentTarget = 40;
    expect(play.checkoutHintDisplay).toBe("D20");

    play.session.state.currentTarget = 51;
    expect(play.checkoutHintDisplay).toBe("T11 D10");

    play.session.state.currentTarget = 169;
    expect(play.checkoutHintDisplay).toBeNull();
  });

  it("submitScore opens failure modal for empty score", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
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
    play.score = "41";
    play.submitScore();
    expect(play.outcome).toBe("success");
    expect(play.modalQuestions[0]?.id).toBe("dartsForFinish");
  });

  it("modalCanSubmit is false when dartsOnDouble > dartsUsed on failure", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.submitScore();
    play.dartsOnDouble = 3;
    play.dartsUsed = 2;
    expect(play.modalCanSubmit).toBe(false);
  });

  it("modalSubmit posts simplified round record", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        session: {
          ...roundsSession,
          state: { ...roundsSession.state, currentRound: 2, currentTarget: 51 },
          roundHistory: [{ roundNumber: 1 }],
        },
      }),
    } as Response);

    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.score = "41";
    play.submitScore();
    play.dartsForFinish = 2;
    play.dartsOnDouble = 1;

    await play.modalSubmit();

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.round).toEqual(
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

  it("undo refreshes session from API response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        session: {
          ...roundsSession,
          state: { ...roundsSession.state, currentRound: 1, currentTarget: 41 },
          roundHistory: [],
        },
      }),
    } as Response);

    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    await play.undo();
    expect(fetch).toHaveBeenCalledWith(
      "/api/games/ten-up-one-down/session/round/last",
      { method: "DELETE" },
    );
  });

  it("leave opens confirmation modal and confirmLeave navigates", () => {
    const open = vi.fn();
    vi.spyOn(Alpine, "store").mockReturnValue({ open });

    const play = tenUpOneDownPlay(structuredClone(roundsSession));

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
    expect(play.session.timeRemainingSeconds).toBe(55);

    play.togglePause();
    expect(play.session.state.status).toBe("paused");
    vi.advanceTimersByTime(5000);
    expect(play.session.timeRemainingSeconds).toBe(55);

    play.togglePause();
    expect(play.session.state.status).toBe("active");
    vi.advanceTimersByTime(5000);
    expect(play.session.timeRemainingSeconds).toBe(50);
  });
});
