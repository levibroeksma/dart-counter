// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("starts at outcome step", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    expect(play.step).toBe("outcome");
  });

  it("advances success flow steps", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.targetHit = true;
    play.wizardNext();
    expect(play.step).toBe("dartCounts");

    play.selectDartsUsed(2);
    expect(play.step).toBe("dartCounts");

    play.selectOnDouble(2);
    expect(play.step).toBe("doubleSelect");

    play.selectFinishedOnDouble("D16");
    expect(play.step).toBe("submit");
  });

  it("shows both dart count pickers on dartCounts step", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.targetHit = true;
    play.wizardNext();
    expect(play.showDartSteps).toBe(true);
    expect(play.step).toBe("dartCounts");
  });

  it("failure with zero darts on double skips double grid", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.targetHit = false;
    play.wizardNext();
    play.selectDartsUsed(3);
    play.selectOnDouble(0);
    expect(play.step).toBe("busted");
    expect(play.showDoubleGrid).toBe(false);
  });

  it("does not advance dart counts until both values are selected", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.targetHit = true;
    play.wizardNext();
    play.selectDartsUsed(2);
    expect(play.step).toBe("dartCounts");
  });

  it("wizardBack returns to previous step", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.targetHit = true;
    play.wizardNext();
    play.selectDartsUsed(1);
    play.wizardBack();
    expect(play.step).toBe("outcome");
  });

  it("resetWizard clears transient wizard state", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.targetHit = true;
    play.selectDartsUsed(1);
    play.selectOnDouble(1);
    play.selectFinishedOnDouble("D16");
    play.step = "submit";

    play.resetWizard();

    expect(play.step).toBe("outcome");
    expect(play.targetHit).toBeNull();
    expect(play.dartsUsed).toBeNull();
    expect(play.onDouble).toBeNull();
    expect(play.finishedOnDouble).toBeNull();
  });

  it("submits round and updates session", async () => {
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
    play.targetHit = true;
    play.dartsUsed = 1;
    play.onDouble = 1;
    play.finishedOnDouble = "D16";

    await play.submit();

    expect(fetch).toHaveBeenCalledWith(
      "/api/games/ten-up-one-down/session/round",
      expect.objectContaining({ method: "POST" }),
    );
    const submitBody = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(submitBody).toEqual(
      expect.objectContaining({
        round: expect.objectContaining({
          roundNumber: 1,
          targetAtStart: 41,
          finished: true,
        }),
        timerExpired: false,
      }),
    );
    expect(play.session.state.currentTarget).toBe(51);
    expect(play.step).toBe("outcome");
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
