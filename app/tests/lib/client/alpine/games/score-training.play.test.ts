// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Alpine from "alpinejs";
import {
  scoreTrainingPlay,
  SCORE_TRAINING_SESSION_KEY,
  clearPersistedScoreTrainingSession,
} from "@lib/client/alpine/games/score-training.play";
import { buildScoreTrainingSession } from "@lib/shared/games/score-training/session-factory";

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
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("starts with ready false, sets ready true after init", () => {
    const play = scoreTrainingPlay(structuredClone(roundsSession));
    expect(play.ready).toBe(false);
    play.init();
    expect(play.ready).toBe(true);
  });

  it("redirects to settings when no server session and no persisted session", () => {
    const play = scoreTrainingPlay(null);
    play.init();
    expect(window.location.href).toBe("/games/settings-score-training");
    expect(play.ready).toBe(false);
  });

  it("redirects to settings when session is already completed", () => {
    const completedSession = {
      ...structuredClone(roundsSession),
      state: { ...roundsSession.state, status: "completed" as const },
    };
    const play = scoreTrainingPlay(completedSession);
    play.init();
    expect(window.location.href).toBe("/games/settings-score-training");
    expect(play.ready).toBe(false);
  });

  it("applies round locally without fetch", () => {
    const play = scoreTrainingPlay(structuredClone(roundsSession));
    play.init();
    play.score = "60";
    play.submitScore();

    expect(fetch).not.toHaveBeenCalled();
    expect(play.session?.state.currentRound).toBe(2);
    expect(play.session?.state.currentScore).toBe(60);
    expect(play.score).toBeNull();
  });

  it("shows showSummary=true with summary=null during completion fetch (skeleton gap)", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(fetch).mockReturnValue(fetchPromise);

    const singleRoundSession = {
      ...structuredClone(roundsSession),
      settings: { endMode: "rounds" as const, roundCount: 1 },
    };
    const play = scoreTrainingPlay(singleRoundSession);
    play.init();
    play.score = "60";
    play.submitScore();

    // Synchronously after submit: game is complete, summary API pending
    expect(play.showSummary).toBe(true);
    expect(play.summary).toBeNull();

    resolveFetch({
      json: async () => ({
        ok: true,
        summary: { totalScore: 60, threeDartAverage: 60, roundsPlayed: 1, dartsThrown: 3 },
      }),
    } as Response);

    await vi.waitFor(() => expect(play.summary).not.toBeNull());
    expect(play.summary?.threeDartAverage).toBe(60);
  });

  it("clears persist storage and redirects on confirmLeave", () => {
    sessionStorage.setItem(
      Alpine.prefixed(SCORE_TRAINING_SESSION_KEY),
      JSON.stringify(roundsSession),
    );
    const play = scoreTrainingPlay(structuredClone(roundsSession));
    play.init();
    play.confirmLeave();

    expect(sessionStorage.getItem(Alpine.prefixed(SCORE_TRAINING_SESSION_KEY))).toBeNull();
    expect(window.location.href).toBe("/games");
  });

  it("clearPersistedScoreTrainingSession removes session from sessionStorage", () => {
    sessionStorage.setItem(Alpine.prefixed(SCORE_TRAINING_SESSION_KEY), "{}");
    clearPersistedScoreTrainingSession();
    expect(sessionStorage.getItem(Alpine.prefixed(SCORE_TRAINING_SESSION_KEY))).toBeNull();
  });

  it("controlsDisabled is true when ready=false", () => {
    const play = scoreTrainingPlay(structuredClone(roundsSession));
    // Before init, ready=false
    expect(play.controlsDisabled).toBe(true);
    play.init();
    expect(play.controlsDisabled).toBe(false);
  });

  it("computes display getters for score stats", () => {
    const play = scoreTrainingPlay(structuredClone(roundsSession));
    expect(play.threeDartAverageDisplay).toBe("0.0");
    expect(play.dartsThrownDisplay).toBe("0");
    expect(play.lastScoreDisplay).toBe("—");

    play.session!.roundHistory = [
      { roundNumber: 1, visitScore: 60, runningTotal: 60 },
      { roundNumber: 2, visitScore: 45, runningTotal: 105 },
    ];
    play.session!.state.currentScore = 105;
    play.session!.state.lastScore = 45;

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
    play.session!.timeRemainingSeconds = 65;
    expect(play.timerDisplay).toBe("01:05");
  });

  it("restarts with same settings via playAgain without fetch", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        summary: {
          totalScore: 60,
          threeDartAverage: 60,
          roundsPlayed: 1,
          dartsThrown: 3,
        },
      }),
    } as Response);

    const play = scoreTrainingPlay(
      buildScoreTrainingSession({ endMode: "rounds", roundCount: 1 }),
    );
    play.init();
    play.score = "60";
    play.submitScore();
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
    expect(play.session?.state.currentScore).toBe(0);
  });

  it("playAgain no-ops when summary is missing", () => {
    const play = scoreTrainingPlay(structuredClone(roundsSession));
    play.init();
    play.showSummary = true;
    play.summary = null;

    play.playAgain();

    expect(play.showSummary).toBe(true);
    expect(play.session?.state.status).toBe("active");
  });

  it("playAgain resets timed session timer and restarts interval", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        summary: {
          totalScore: 0,
          threeDartAverage: 0,
          roundsPlayed: 0,
          dartsThrown: 0,
        },
      }),
    } as Response);

    const play = scoreTrainingPlay(
      buildScoreTrainingSession({ endMode: "timed", playtimeSeconds: 90 }),
    );
    play.init();
    play.completeOnTimerExpiry();
    await vi.waitFor(() => expect(play.summary).not.toBeNull());

    play.playAgain();

    expect(play.session?.timeRemainingSeconds).toBe(90);
    expect(play.session?.state.status).toBe("active");

    vi.advanceTimersByTime(1000);
    expect(play.session?.timeRemainingSeconds).toBe(89);
  });
});
