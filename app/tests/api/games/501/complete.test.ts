import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "@api/games/501/complete";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import {
  applyVisit,
  buildFiveOhOneSession,
  createEmpty501Stats,
} from "@lib/shared/games/501";

const mockGetSession = vi.fn();
const mockGetPlayer501Stats = vi.fn();
const mockSavePlayer501Stats = vi.fn();
const mockIncrementPlayCount = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/player-501-stats", () => ({
  getPlayer501Stats: (...args: unknown[]) => mockGetPlayer501Stats(...args),
  savePlayer501Stats: (...args: unknown[]) => mockSavePlayer501Stats(...args),
}));

vi.mock("@lib/server/data/games", () => ({
  incrementPlayCount: (...args: unknown[]) => mockIncrementPlayCount(...args),
}));

function buildCompletedSession() {
  let session = buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 1,
    unit: "legs",
    players: [{ id: "u1", type: "user", name: "Levi" }],
  });

  for (const score of [180, 180, 141]) {
    session = applyVisit(session, score);
  }

  return session;
}

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/501/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/501/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      userId: "00000000-0000-4000-8000-000000000001",
    });
    mockGetPlayer501Stats.mockResolvedValue(createEmpty501Stats());
    mockSavePlayer501Stats.mockResolvedValue(undefined);
    mockIncrementPlayCount.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });
    const response = await POST(createContext(buildCompletedSession()));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 400 for incomplete session", async () => {
    const response = await POST(
      createContext(
        buildFiveOhOneSession({
          matchMode: "first-to",
          targetCount: 1,
          unit: "legs",
          players: [{ id: "u1", type: "user", name: "Levi" }],
        }),
      ),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.GAME_NOT_COMPLETE,
    });
  });

  it("saves stats, increments play count, and returns summary", async () => {
    const session = buildCompletedSession();
    const response = await POST(createContext({ session }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.summary).toEqual({
      resultLabel: "Completed",
      matchFormatLabel: "First to 1 leg",
      legsPlayed: 1,
      userThreeDartAverage: 167,
      userDartsThrown: 9,
      checkouts: 1,
    });
    expect(mockSavePlayer501Stats).toHaveBeenCalledTimes(1);
    expect(mockIncrementPlayCount).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "501",
    );
  });
});
