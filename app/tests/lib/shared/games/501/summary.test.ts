import { describe, expect, it } from "vitest";
import { buildFiveOhOneSession, buildSummary } from "@lib/shared/games/501";

describe("buildSummary", () => {
  it("builds completed 1-player summary", () => {
    const session = buildFiveOhOneSession({
      matchMode: "first-to",
      targetCount: 1,
      unit: "legs",
      players: [{ id: "u1", type: "user", name: "Levi" }],
    });

    session.state.status = "completed";
    session.state.phase = "summary";
    session.visitHistory = [
      {
        visitNumber: 1,
        playerId: "u1",
        visitScore: 180,
        remainingBefore: 501,
        remainingAfter: 321,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 2,
        playerId: "u1",
        visitScore: 321,
        remainingBefore: 321,
        remainingAfter: 0,
        bust: false,
        checkout: true,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
    ];

    expect(buildSummary(session)).toEqual({
      resultLabel: "Completed",
      matchFormatLabel: "First to 1 leg",
      legsPlayed: 1,
      userThreeDartAverage: 250.5,
      userDartsThrown: 6,
      checkouts: 1,
    });
  });

  it("builds completed 2-player summary and includes guest stats", () => {
    const session = buildFiveOhOneSession({
      matchMode: "first-to",
      targetCount: 3,
      unit: "legs",
      players: [
        { id: "u1", type: "user", name: "Levi" },
        { id: "g1", type: "guest", name: "Guest" },
      ],
    });

    session.state.status = "completed";
    session.state.phase = "summary";
    session.visitHistory = [
      {
        visitNumber: 1,
        playerId: "u1",
        visitScore: 100,
        remainingBefore: 501,
        remainingAfter: 401,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 2,
        playerId: "g1",
        visitScore: 120,
        remainingBefore: 501,
        remainingAfter: 381,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 3,
        playerId: "u1",
        visitScore: 100,
        remainingBefore: 401,
        remainingAfter: 301,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 4,
        playerId: "g1",
        visitScore: 120,
        remainingBefore: 381,
        remainingAfter: 261,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 5,
        playerId: "u1",
        visitScore: 100,
        remainingBefore: 301,
        remainingAfter: 201,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 6,
        playerId: "g1",
        visitScore: 120,
        remainingBefore: 261,
        remainingAfter: 141,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 7,
        playerId: "g1",
        visitScore: 141,
        remainingBefore: 141,
        remainingAfter: 0,
        bust: false,
        checkout: true,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
    ];

    expect(buildSummary(session)).toEqual({
      resultLabel: "Guest wins",
      matchFormatLabel: "First to 3 legs",
      legsPlayed: 1,
      userThreeDartAverage: 100,
      userDartsThrown: 9,
      checkouts: 0,
      guestThreeDartAverage: 125.25,
      guestDartsThrown: 12,
      guestCheckouts: 1,
    });
  });

  it("includes opponent stats for dartbot", () => {
    const session = buildFiveOhOneSession(
      {
        matchMode: "first-to",
        targetCount: 3,
        unit: "legs",
        players: [
          { id: "u1", type: "user", name: "Levi" },
          { id: "b1", type: "dartbot", name: "DartBot", level: 10 },
        ],
      },
      "u1",
    );

    session.state.status = "completed";
    session.state.phase = "summary";
    session.visitHistory = [
      {
        visitNumber: 1,
        playerId: "u1",
        visitScore: 100,
        remainingBefore: 501,
        remainingAfter: 401,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 2,
        playerId: "b1",
        visitScore: 120,
        remainingBefore: 501,
        remainingAfter: 381,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 3,
        playerId: "b1",
        visitScore: 381,
        remainingBefore: 381,
        remainingAfter: 0,
        bust: false,
        checkout: true,
        legNumber: 1,
        setNumber: 1,
        stateSnapshot: structuredClone(session.state),
      },
    ];

    const summary = buildSummary(session);

    expect(summary.guestThreeDartAverage).toBeDefined();
    expect(summary.guestDartsThrown).toBe(6);
    expect(summary.guestCheckouts).toBe(1);
    expect(summary.resultLabel).toContain("DartBot");
  });
});
