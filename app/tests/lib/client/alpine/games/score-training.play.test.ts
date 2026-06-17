// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scoreTrainingPlay } from "@lib/client/alpine/games/score-training.play";

const roundsSession = {
  slug: "score-training" as const,
  settings: { endMode: "rounds" as const, roundCount: 10 },
  state: {
    currentRound: 1,
    currentScore: 0,
    status: "active" as const,
    lastScore: null,
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

describe("scoreTrainingPlay", () => {
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

  it("computes display getters for score stats", () => {
    const play = scoreTrainingPlay(structuredClone(roundsSession));
    expect(play.threeDartAverageDisplay).toBe("0.0");
    expect(play.dartsThrownDisplay).toBe("0");
    expect(play.lastScoreDisplay).toBe("—");

    play.session.roundHistory = [
      { roundNumber: 1, visitScore: 60, runningTotal: 60 },
      { roundNumber: 2, visitScore: 45, runningTotal: 105 },
    ];
    play.session.state.currentScore = 105;
    play.session.state.lastScore = 45;

    expect(play.threeDartAverageDisplay).toBe("52.5");
    expect(play.dartsThrownDisplay).toBe("6");
    expect(play.lastScoreDisplay).toBe("45");
  });

  it("disables timer tick when entering score", () => {
    const play = scoreTrainingPlay(structuredClone(timedSession));
    expect(play.timerShouldTick).toBe(true);

    play.score = "6";
    expect(play.timerShouldTick).toBe(false);
  });

  it("formats timer display as MM:SS", () => {
    const play = scoreTrainingPlay(structuredClone(timedSession));
    play.session.timeRemainingSeconds = 65;
    expect(play.timerDisplay).toBe("01:05");
  });

  it("posts round, updates session, and clears score", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        session: {
          ...roundsSession,
          state: { ...roundsSession.state, currentRound: 2, currentScore: 60, lastScore: 60 },
          roundHistory: [{ roundNumber: 1, visitScore: 60, runningTotal: 60 }],
        },
      }),
    } as Response);

    const play = scoreTrainingPlay(structuredClone(roundsSession));
    play.score = "60";
    await play.submitScore();

    expect(fetch).toHaveBeenCalledWith(
      "/api/games/score-training/session/round",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.round).toEqual({
      roundNumber: 1,
      visitScore: 60,
      runningTotal: 60,
    });
    expect(body.timeRemainingSeconds).toBeUndefined();
    expect(body.timerExpired).toBe(false);
    expect(play.session.state.currentRound).toBe(2);
    expect(play.score).toBeNull();
    expect(play.showSummary).toBe(false);
  });

  it("stores summary and shows it when round response is completed", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        completed: true,
        summary: { totalScore: 240, threeDartAverage: 60, roundsPlayed: 4, dartsThrown: 12 },
        session: {
          ...roundsSession,
          state: {
            ...roundsSession.state,
            currentRound: 5,
            currentScore: 240,
            status: "completed",
            lastScore: 60,
          },
          roundHistory: [
            { roundNumber: 1, visitScore: 60, runningTotal: 60 },
            { roundNumber: 2, visitScore: 60, runningTotal: 120 },
            { roundNumber: 3, visitScore: 60, runningTotal: 180 },
            { roundNumber: 4, visitScore: 60, runningTotal: 240 },
          ],
        },
      }),
    } as Response);

    const play = scoreTrainingPlay(structuredClone(roundsSession));
    play.score = "60";
    await play.submitScore();

    expect(play.showSummary).toBe(true);
    expect(play.summaryAverageDisplay).toBe("60.0");
  });
});
