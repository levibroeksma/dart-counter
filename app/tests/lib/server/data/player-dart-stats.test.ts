import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";

const mockGet = vi.fn();
const mockSetJSON = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: (...args: unknown[]) => mockGet(...args),
    setJSON: (...args: unknown[]) => mockSetJSON(...args),
  })),
}));

import {
  getPlayerDartStats,
  savePlayerDartStats,
} from "@lib/server/data/player-dart-stats";

describe("player-dart-stats data layer", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetJSON.mockReset();
  });

  it("returns empty stats when none stored", async () => {
    mockGet.mockResolvedValue(null);

    const stats = await getPlayerDartStats("alex");

    expect(stats.totalCheckouts).toBe(0);
    expect(stats.doubleStats.D1.attempts).toBe(0);
    expect(stats.doubleStats.D1.successes).toBe(0);
  });

  it("returns stored stats when found", async () => {
    mockGet.mockResolvedValue({
      doubleStats: createEmptyPlayerDartStats().doubleStats,
      totalCheckouts: 4,
      totalCheckoutDarts: 9,
    });

    const stats = await getPlayerDartStats("alex");

    expect(stats.totalCheckouts).toBe(4);
    expect(stats.totalCheckoutDarts).toBe(9);
  });

  it("saves stats for user key", async () => {
    mockSetJSON.mockResolvedValue(undefined);
    const stats = createEmptyPlayerDartStats();
    stats.totalCheckouts = 5;

    await savePlayerDartStats("alex", stats);

    expect(mockSetJSON).toHaveBeenCalledWith("alex", stats);
  });
});
