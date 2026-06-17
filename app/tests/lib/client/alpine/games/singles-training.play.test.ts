// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { singlesTrainingPlay } from "@lib/client/alpine/games/singles-training.play";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";

const baseSession: SinglesTrainingSession = {
  slug: "singles-training" as const,
  settings: {
    direction: "low-to-high" as const,
    mode: "normal" as const,
    scoring: "traditional" as const,
  },
  targetSequence: [1, 2, 3, "bull"],
  state: {
    status: "active" as const,
    currentTargetIndex: 0,
    currentDartInVisit: 0 as 0 | 1 | 2,
    score: 0,
    segmentCounts: { miss: 0, single: 0, double: 0, triple: 0 },
  },
  dartHistory: [],
  createdAt: "",
  updatedAt: "",
};

describe("singlesTrainingPlay", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("disables controls while loading or on summary", () => {
    const play = singlesTrainingPlay(structuredClone(baseSession));
    expect(play.controlsDisabled).toBe(false);

    play.loading = true;
    expect(play.controlsDisabled).toBe(true);

    play.loading = false;
    play.showSummary = true;
    expect(play.controlsDisabled).toBe(true);
  });

  it("derives target getters and visit labels", () => {
    const play = singlesTrainingPlay(structuredClone(baseSession));
    expect(play.currentTarget).toBe(1);
    expect(play.isBullTarget).toBe(false);
    expect(play.targetDisplay).toBe("1");
    expect(play.visitDartLabels).toEqual(["-", "-", "-"]);

    play.session.dartHistory = [
      {
        targetIndex: 0,
        dartInVisit: 0 as const,
        outcome: { type: "single" as const },
        points: 1,
      },
      {
        targetIndex: 0,
        dartInVisit: 1 as const,
        outcome: { type: "double" as const },
        points: 2,
      },
    ];
    expect(play.visitDartLabels).toEqual(["S1", "D1", "-"]);

    play.session.state.currentTargetIndex = 3;
    play.session.dartHistory = [
      {
        targetIndex: 3,
        dartInVisit: 0 as const,
        outcome: { type: "single" as const },
        points: 1,
      },
      {
        targetIndex: 3,
        dartInVisit: 1 as const,
        outcome: { type: "double" as const },
        points: 2,
      },
    ];
    expect(play.isBullTarget).toBe(true);
    expect(play.targetDisplay).toBe("Bull");
    expect(play.visitDartLabels).toEqual(["25", "Bull", "-"]);
  });

  it("submits dart and updates session", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        session: {
          ...baseSession,
          state: {
            ...baseSession.state,
            currentDartInVisit: 1,
            score: 1,
            segmentCounts: { miss: 0, single: 1, double: 0, triple: 0 },
          },
          dartHistory: [
            {
              targetIndex: 0,
              dartInVisit: 0,
              outcome: { type: "single" },
              points: 1,
            },
          ],
        },
      }),
    } as Response);

    const play = singlesTrainingPlay(structuredClone(baseSession));
    await play.submitDart({ type: "single" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/games/singles-training/session/dart",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(play.session.state.score).toBe(1);
    expect(play.showSummary).toBe(false);
    expect(play.summary).toBeNull();
  });

  it("shows summary on terminal dart response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        terminal: true,
        summary: {
          status: "completed",
          score: 63,
          segmentCounts: { miss: 1, single: 2, double: 3, triple: 4 },
          hitRatio: 0.75,
          dartPositionSuccessRates: [0.8, 0.7, 0.6],
          targetsCompleted: 21,
          dartsThrown: 84,
        },
        session: {
          ...baseSession,
          state: {
            ...baseSession.state,
            status: "completed",
            score: 63,
          },
        },
      }),
    } as Response);

    const play = singlesTrainingPlay(structuredClone(baseSession));
    await play.submitDart({ type: "double" });

    expect(play.showSummary).toBe(true);
    expect(play.summary?.score).toBe(63);
  });

  it("undos the last dart", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        session: {
          ...baseSession,
          state: { ...baseSession.state, currentDartInVisit: 0, score: 0 },
          dartHistory: [],
        },
      }),
    } as Response);

    const play = singlesTrainingPlay({
      ...structuredClone(baseSession),
      state: { ...baseSession.state, currentDartInVisit: 1, score: 1 },
      dartHistory: [
        {
          targetIndex: 0,
          dartInVisit: 0,
          outcome: { type: "single" },
          points: 1,
        },
      ],
    });

    await play.undoDart();

    expect(fetch).toHaveBeenCalledWith(
      "/api/games/singles-training/session/dart/last",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(play.session.dartHistory).toEqual([]);
  });

  it("restarts session with play again", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true, session: structuredClone(baseSession) }),
    } as Response);

    const play = singlesTrainingPlay(structuredClone(baseSession));
    play.showSummary = true;
    play.summary = {
      status: "dead",
      score: 2,
      segmentCounts: { miss: 1, single: 1, double: 0, triple: 0 },
      hitRatio: 0.5,
      dartPositionSuccessRates: [1, 0, 0],
      targetsCompleted: 0,
      dartsThrown: 2,
    };

    await play.playAgain();

    expect(fetch).toHaveBeenCalledWith(
      "/api/games/singles-training/session/play-again",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body).toEqual(baseSession.settings);
    expect(play.showSummary).toBe(false);
    expect(play.summary).toBeNull();
  });
});
