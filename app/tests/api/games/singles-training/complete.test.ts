import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "@api/games/singles-training/complete";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { createEmptySinglesTrainingStats } from "@lib/shared/games/singles-training/stats";
import { buildSinglesTrainingSession } from "@lib/shared/games/singles-training/session-factory";
import { applyDartToSession } from "@lib/shared/games/singles-training/state";

const mockGetSession = vi.fn();
const mockGetPlayerSinglesTrainingStats = vi.fn();
const mockSavePlayerSinglesTrainingStats = vi.fn();
const mockIncrementPlayCount = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/player-singles-training-stats", () => ({
  getPlayerSinglesTrainingStats: (...args: unknown[]) =>
    mockGetPlayerSinglesTrainingStats(...args),
  savePlayerSinglesTrainingStats: (...args: unknown[]) =>
    mockSavePlayerSinglesTrainingStats(...args),
}));

vi.mock("@lib/server/data/games", () => ({
  incrementPlayCount: (...args: unknown[]) => mockIncrementPlayCount(...args),
}));

function buildDeadSession() {
  let session = buildSinglesTrainingSession({
    direction: "low-to-high",
    mode: "hard",
    scoring: "traditional",
  });
  session = applyDartToSession(session, { type: "miss" });
  session = applyDartToSession(session, { type: "miss" });
  session = applyDartToSession(session, { type: "miss" });
  return session;
}

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/games/singles-training/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("POST /api/games/singles-training/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      userId: "00000000-0000-4000-8000-000000000001",
    });
    mockGetPlayerSinglesTrainingStats.mockResolvedValue(
      createEmptySinglesTrainingStats(),
    );
    mockSavePlayerSinglesTrainingStats.mockResolvedValue(undefined);
    mockIncrementPlayCount.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });
    const response = await POST(createContext({ session: buildDeadSession() }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("returns 400 for active session", async () => {
    const response = await POST(
      createContext({
        session: buildSinglesTrainingSession({
          direction: "low-to-high",
          mode: "normal",
          scoring: "traditional",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.GAME_NOT_COMPLETE,
    });
  });

  it("saves stats, increments play count, and returns summary", async () => {
    const session = buildDeadSession();
    const response = await POST(createContext({ session }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.summary.status).toBe("dead");
    expect(data.summary.dartsThrown).toBe(3);
    expect(mockSavePlayerSinglesTrainingStats).toHaveBeenCalledTimes(1);
    expect(mockIncrementPlayCount).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "singles-training",
    );
  });
});
