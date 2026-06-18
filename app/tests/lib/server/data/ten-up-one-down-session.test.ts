import { describe, it, expect, beforeEach } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb } from "@tests/helpers/mock-db";

import {
  createTenUpOneDownSession,
  getTenUpOneDownSession,
  saveTenUpOneDownSession,
  deleteTenUpOneDownSession,
} from "@lib/server/data/ten-up-one-down-session";

describe("ten-up-one-down session data layer", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("creates session with initial state", async () => {
    const session = await createTenUpOneDownSession("alex", {
      endMode: "rounds",
      roundCount: 10,
    });

    expect(session.slug).toBe("ten-up-one-down");
    expect(session.state.currentTarget).toBe(41);
    expect(session.timeRemainingSeconds).toBeNull();
    expect(mockDb.tables.gameSessions.get("alex:ten-up-one-down")).toEqual(
      expect.objectContaining({
        userId: "alex",
        gameSlug: "ten-up-one-down",
        sessionData: expect.objectContaining({ slug: "ten-up-one-down" }),
      }),
    );
  });

  it("creates timed session with countdown", async () => {
    const session = await createTenUpOneDownSession("alex", {
      endMode: "timed",
      playtimeSeconds: 600,
    });

    expect(session.timeRemainingSeconds).toBe(600);
  });

  it("gets existing session", async () => {
    mockDb.tables.gameSessions.set("alex:ten-up-one-down", {
      userId: "alex",
      gameSlug: "ten-up-one-down",
      sessionData: {
        slug: "ten-up-one-down",
        settings: { endMode: "rounds", roundCount: 10 },
        state: {
          currentRound: 2,
          currentTarget: 50,
          status: "active",
          lastAdjustment: null,
        },
        roundHistory: [],
        timeRemainingSeconds: null,
        createdAt: "",
        updatedAt: "",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const session = await getTenUpOneDownSession("alex");

    expect(session?.state.currentTarget).toBe(50);
  });

  it("returns null for legacy config blobs", async () => {
    mockDb.tables.gameSessions.set("alex:ten-up-one-down", {
      userId: "alex",
      gameSlug: "ten-up-one-down",
      sessionData: {
        slug: "ten-up-one-down",
        settings: { targetScore: 10 },
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(getTenUpOneDownSession("alex")).resolves.toBeNull();
  });

  it("saves session", async () => {
    await saveTenUpOneDownSession("alex", {
      slug: "ten-up-one-down",
      settings: { endMode: "rounds", roundCount: 10 },
      state: {
        currentRound: 1,
        currentTarget: 41,
        status: "active",
        lastAdjustment: null,
      },
      roundHistory: [],
      timeRemainingSeconds: null,
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    });

    expect(
      mockDb.tables.gameSessions.get("alex:ten-up-one-down")?.sessionData,
    ).toEqual(
      expect.objectContaining({ slug: "ten-up-one-down" }),
    );
  });

  it("deletes session", async () => {
    mockDb.tables.gameSessions.set("alex:ten-up-one-down", {
      userId: "alex",
      gameSlug: "ten-up-one-down",
      sessionData: {
        slug: "ten-up-one-down",
        settings: { endMode: "rounds", roundCount: 10 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await deleteTenUpOneDownSession("alex");

    expect(mockDb.tables.gameSessions.get("alex:ten-up-one-down")).toBeUndefined();
  });
});
