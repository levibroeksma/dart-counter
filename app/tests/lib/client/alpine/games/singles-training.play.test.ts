// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Alpine from "alpinejs";
import {
  clearPersistedSinglesTrainingSession,
  singlesTrainingPlay,
  SINGLES_TRAINING_SESSION_KEY,
} from "@lib/client/alpine/games/singles-training.play";
import { buildSinglesTrainingSession } from "@lib/shared/games/singles-training/session-factory";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";
import { applyDartToSession } from "@lib/shared/games/singles-training/state";

beforeAll(() => {
  (Alpine as unknown as Record<string, unknown>).$persist = (value: unknown) => ({
    as: (_key: string) => ({ using: (_storage: Storage) => value }),
  });
});

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
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("starts with ready=false and sets ready=true after init", () => {
    const play = singlesTrainingPlay(structuredClone(baseSession));
    expect(play.ready).toBe(false);
    play.init();
    expect(play.ready).toBe(true);
  });

  it("redirects to settings when session is invalid", () => {
    const play = singlesTrainingPlay(null);
    play.init();
    expect(window.location.href).toBe("/games/settings-singles-training");
    expect(play.ready).toBe(false);
  });

  it("redirects to settings when session is not active", () => {
    const deadSession = {
      ...structuredClone(baseSession),
      state: { ...baseSession.state, status: "dead" as const },
    };
    const play = singlesTrainingPlay(deadSession);
    play.init();
    expect(window.location.href).toBe("/games/settings-singles-training");
    expect(play.ready).toBe(false);
  });

  it("disables controls while ready=false, loading, or on summary", () => {
    const play = singlesTrainingPlay(structuredClone(baseSession));
    expect(play.controlsDisabled).toBe(true);

    play.init();
    expect(play.controlsDisabled).toBe(false);

    play.loading = true;
    expect(play.controlsDisabled).toBe(true);

    play.loading = false;
    play.showSummary = true;
    expect(play.controlsDisabled).toBe(true);
  });

  it("derives target getters and visit labels", () => {
    const play = singlesTrainingPlay(structuredClone(baseSession));
    play.init();
    expect(play.currentTarget).toBe(1);
    expect(play.isBullTarget).toBe(false);
    expect(play.targetDisplay).toBe("1");
    expect(play.visitDartLabels).toEqual(["-", "-", "-"]);

    play.session!.dartHistory = [
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

    play.session!.state.currentTargetIndex = 3;
    play.session!.dartHistory = [
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

  it("applies dart locally without fetch", () => {
    const play = singlesTrainingPlay(structuredClone(baseSession));
    play.init();
    play.submitDart({ type: "single" });

    expect(fetch).not.toHaveBeenCalled();
    expect(play.session?.state.score).toBe(1);
    expect(play.session?.state.currentDartInVisit).toBe(1);
    expect(play.showSummary).toBe(false);
    expect(play.summary).toBeNull();
  });

  it("shows summary skeleton gap on terminal dart", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(fetch).mockReturnValue(fetchPromise);

    let session = buildSinglesTrainingSession({
      direction: "low-to-high",
      mode: "hard",
      scoring: "traditional",
    });
    session = applyDartToSession(session, { type: "miss" });
    session = applyDartToSession(session, { type: "miss" });

    const play = singlesTrainingPlay(session);
    play.init();
    play.submitDart({ type: "miss" });

    expect(play.showSummary).toBe(true);
    expect(play.summary).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/games/singles-training/complete",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    resolveFetch({
      json: async () => ({
        ok: true,
        summary: {
          status: "dead",
          score: 0,
          segmentCounts: { miss: 3, single: 0, double: 0, triple: 0 },
          hitRatio: 0,
          dartPositionSuccessRates: [0, 0, 0],
          targetsCompleted: 0,
          dartsThrown: 3,
        },
      }),
    } as Response);

    await vi.waitFor(() => expect(play.summary).not.toBeNull());
    expect(play.summary?.status).toBe("dead");
  });

  it("undos dart locally without fetch", () => {
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
    play.init();
    play.undoDart();

    expect(fetch).not.toHaveBeenCalled();
    expect(play.session?.dartHistory).toEqual([]);
    expect(play.session?.state.currentDartInVisit).toBe(0);
    expect(play.session?.state.score).toBe(0);
  });

  it("playAgain rebuilds session without fetch", () => {
    const play = singlesTrainingPlay(structuredClone(baseSession));
    play.init();
    play.showSummary = true;
    play.summary = {
      status: "dead",
      score: 0,
      segmentCounts: { miss: 3, single: 0, double: 0, triple: 0 },
      hitRatio: 0,
      dartPositionSuccessRates: [0, 0, 0],
      targetsCompleted: 0,
      dartsThrown: 3,
    };

    play.playAgain();

    expect(fetch).not.toHaveBeenCalled();
    expect(play.showSummary).toBe(false);
    expect(play.summary).toBeNull();
    expect(play.error).toBe("");
    expect(play.session?.state.status).toBe("active");
    expect(play.session?.dartHistory).toEqual([]);
  });

  it("confirmLeave clears persisted session and redirects", () => {
    sessionStorage.setItem(Alpine.prefixed(SINGLES_TRAINING_SESSION_KEY), "{}");
    const play = singlesTrainingPlay(structuredClone(baseSession));
    play.init();
    play.confirmLeave();

    expect(sessionStorage.getItem(Alpine.prefixed(SINGLES_TRAINING_SESSION_KEY))).toBeNull();
    expect(window.location.href).toBe("/games");
  });

  it("clearPersistedSinglesTrainingSession removes persisted session", () => {
    sessionStorage.setItem(Alpine.prefixed(SINGLES_TRAINING_SESSION_KEY), "{}");
    clearPersistedSinglesTrainingSession();
    expect(sessionStorage.getItem(Alpine.prefixed(SINGLES_TRAINING_SESSION_KEY))).toBeNull();
  });
});
