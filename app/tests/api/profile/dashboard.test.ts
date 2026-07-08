import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { GET } from "@api/profile/dashboard";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { TEST_USER_ID } from "@tests/helpers/constants";

const mockGetProfileDashboardData = vi.fn();
const mockGetPreferences = vi.fn();

vi.mock("@lib/server/data/player-stat-completions", () => ({
  getProfileDashboardData: (...args: unknown[]) =>
    mockGetProfileDashboardData(...args),
}));

vi.mock("@lib/server/data/preferences", () => ({
  getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
}));

const mockSession: { isLoggedIn: boolean; userId?: string } = {
  isLoggedIn: false,
};

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => mockSession),
}));

function createGetContext(): APIContext {
  return {
    request: new Request("http://localhost/api/profile/dashboard"),
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

const emptyDashboard = {
  metrics: {
    threeDartAverage: null,
    scoringAverage: null,
    checkoutPercentage: null,
  },
  sparklines: [],
  gamesPlayed: 0,
  gamesWon: 0,
};

describe("GET /api/profile/dashboard", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockSession.userId = undefined;
    mockGetProfileDashboardData.mockReset();
    mockGetPreferences.mockReset();
  });

  it("returns 401 when not logged in", async () => {
    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns dashboard data and displayName when logged in", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = TEST_USER_ID;
    mockGetProfileDashboardData.mockResolvedValue({
      ...emptyDashboard,
      gamesPlayed: 5,
      gamesWon: 2,
    });
    mockGetPreferences.mockResolvedValue({ displayName: "Alex" });

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      ok: true,
      displayName: "Alex",
      gamesPlayed: 5,
      gamesWon: 2,
      metrics: emptyDashboard.metrics,
      sparklines: [],
    });
    expect(mockGetProfileDashboardData).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mockGetPreferences).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("returns 500 when dashboard fetch fails", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = TEST_USER_ID;
    mockGetProfileDashboardData.mockRejectedValue(new Error("db down"));

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_ERROR });
  });
});
