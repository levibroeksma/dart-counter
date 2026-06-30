import { describe, it, expect } from "vitest";
import { isTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down";

const validSession = {
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
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("isTenUpOneDownSession", () => {
  it("accepts a valid session document", () => {
    expect(isTenUpOneDownSession(validSession)).toBe(true);
  });

  it("rejects legacy config-only shapes without state", () => {
    expect(
      isTenUpOneDownSession({
        slug: "ten-up-one-down",
        settings: { targetScore: 10 },
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isTenUpOneDownSession(null)).toBe(false);
    expect(isTenUpOneDownSession(undefined)).toBe(false);
  });
});
