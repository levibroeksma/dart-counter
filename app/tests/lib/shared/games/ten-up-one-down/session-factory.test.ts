import { describe, it, expect } from "vitest";
import { buildTenUpOneDownSession, STARTING_TARGET } from "@lib/shared/games/ten-up-one-down";

describe("buildTenUpOneDownSession", () => {
  it("creates an active rounds session", () => {
    const session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 });
    expect(session.slug).toBe("ten-up-one-down");
    expect(session.state.status).toBe("active");
    expect(session.state.currentRound).toBe(1);
    expect(session.state.currentTarget).toBe(STARTING_TARGET);
    expect(session.roundHistory).toEqual([]);
    expect(session.timeRemainingSeconds).toBeNull();
    expect(session.createdAt).toMatch(/^\d{4}-/);
    expect(session.updatedAt).toMatch(/^\d{4}-/);
  });

  it("sets timeRemainingSeconds for timed mode", () => {
    const session = buildTenUpOneDownSession({ endMode: "timed", playtimeSeconds: 600 });
    expect(session.timeRemainingSeconds).toBe(600);
  });
});
