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
    expect(play.step).toBe("dartsUsed");

    play.dartsUsed = 2;
    play.wizardNext();
    expect(play.step).toBe("onDouble");

    play.onDouble = 2;
    play.wizardNext();
    expect(play.step).toBe("doubleSelect");
  });

  it("wizardBack returns to previous step", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.targetHit = true;
    play.wizardNext();
    play.dartsUsed = 1;
    play.wizardBack();
    expect(play.step).toBe("outcome");
  });

  it("resetWizard clears transient wizard state", () => {
    const play = tenUpOneDownPlay(structuredClone(roundsSession));
    play.targetHit = true;
    play.dartsUsed = 1;
    play.onDouble = 1;
    play.finishedOnDouble = "D16";
    play.step = "submit";

    play.resetWizard();

    expect(play.step).toBe("outcome");
    expect(play.targetHit).toBeNull();
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
      expect.objectContaining({ method: "POST" })
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
      { method: "DELETE" }
    );
  });

  it("init and pause handle timed countdown", () => {
    vi.useFakeTimers();
    const play = tenUpOneDownPlay(structuredClone(timedSession));

    play.init();
    vi.advanceTimersByTime(2000);
    expect(play.session.timeRemainingSeconds).toBe(58);

    play.togglePause();
    expect(play.session.state.status).toBe("paused");
    vi.advanceTimersByTime(2000);
    expect(play.session.timeRemainingSeconds).toBe(58);
  });
});
