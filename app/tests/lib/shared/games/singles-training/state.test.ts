import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  applyDartToSession,
  revertLastDart,
  getMinimumHitsForMode,
} from "@lib/shared/games/singles-training/state";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";

function baseSession(mode: "normal" | "hard" | "extreme"): SinglesTrainingSession {
  return {
    slug: "singles-training",
    settings: { direction: "low-to-high", mode, scoring: "traditional" },
    targetSequence: [10, 11, "bull"],
    state: createInitialGameState(),
    dartHistory: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("applyDartToSession", () => {
  it("advances dart index within visit", () => {
    const session = baseSession("normal");
    const next = applyDartToSession(session, { type: "single" });
    expect(next.state.currentDartInVisit).toBe(1);
    expect(next.state.score).toBe(1);
  });

  it("hard mode sets dead after 3 misses on target", () => {
    let session = baseSession("hard");
    session = applyDartToSession(session, { type: "miss" });
    session = applyDartToSession(session, { type: "miss" });
    session = applyDartToSession(session, { type: "miss" });
    expect(session.state.status).toBe("dead");
  });

  it("normal mode advances target after 3 darts", () => {
    let session = baseSession("normal");
    session = applyDartToSession(session, { type: "miss" });
    session = applyDartToSession(session, { type: "miss" });
    session = applyDartToSession(session, { type: "miss" });
    expect(session.state.currentTargetIndex).toBe(1);
    expect(session.state.currentDartInVisit).toBe(0);
  });
});

describe("revertLastDart", () => {
  it("undoes last dart and recalculates score", () => {
    let session = baseSession("normal");
    session = applyDartToSession(session, { type: "triple" });
    session = revertLastDart(session);
    expect(session.dartHistory).toHaveLength(0);
    expect(session.state.score).toBe(0);
  });
});

describe("getMinimumHitsForMode", () => {
  it("returns correct minimums", () => {
    expect(getMinimumHitsForMode("normal")).toBe(0);
    expect(getMinimumHitsForMode("hard")).toBe(1);
    expect(getMinimumHitsForMode("extreme")).toBe(2);
  });
});
