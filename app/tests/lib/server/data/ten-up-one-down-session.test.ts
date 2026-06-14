import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSetJSON = vi.fn();
const mockDelete = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: (...args: unknown[]) => mockGet(...args),
    setJSON: (...args: unknown[]) => mockSetJSON(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  })),
}));

import {
  createTenUpOneDownSession,
  getTenUpOneDownSession,
  saveTenUpOneDownSession,
  deleteTenUpOneDownSession,
} from "@lib/server/data/ten-up-one-down-session";

describe("ten-up-one-down session data layer", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetJSON.mockReset();
    mockDelete.mockReset();
  });

  it("creates session with initial state", async () => {
    mockSetJSON.mockResolvedValue(undefined);

    const session = await createTenUpOneDownSession("alex", {
      endMode: "rounds",
      roundCount: 10,
    });

    expect(session.slug).toBe("ten-up-one-down");
    expect(session.state.currentTarget).toBe(41);
    expect(session.timeRemainingSeconds).toBeNull();
    expect(mockSetJSON).toHaveBeenCalledWith(
      "alex:ten-up-one-down",
      expect.any(Object)
    );
  });

  it("creates timed session with countdown", async () => {
    mockSetJSON.mockResolvedValue(undefined);

    const session = await createTenUpOneDownSession("alex", {
      endMode: "timed",
      playtimeSeconds: 600,
    });

    expect(session.timeRemainingSeconds).toBe(600);
  });

  it("gets existing session", async () => {
    mockGet.mockResolvedValue({
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
    });

    const session = await getTenUpOneDownSession("alex");

    expect(session?.state.currentTarget).toBe(50);
  });

  it("saves session", async () => {
    mockSetJSON.mockResolvedValue(undefined);

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

    expect(mockSetJSON).toHaveBeenCalledWith(
      "alex:ten-up-one-down",
      expect.objectContaining({ slug: "ten-up-one-down" })
    );
  });

  it("deletes session", async () => {
    mockDelete.mockResolvedValue(undefined);

    await deleteTenUpOneDownSession("alex");

    expect(mockDelete).toHaveBeenCalledWith("alex:ten-up-one-down");
  });
});
