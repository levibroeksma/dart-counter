import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { GET, POST, DELETE } from "../../../../src/pages/api/games/score-training/session";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetSession = vi.fn();
const mockCreateSession = vi.fn();
const mockGetScoreTrainingSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/score-training-session", () => ({
  createScoreTrainingSession: (...args: unknown[]) => mockCreateSession(...args),
  getScoreTrainingSession: (...args: unknown[]) => mockGetScoreTrainingSession(...args),
  deleteScoreTrainingSession: (...args: unknown[]) => mockDeleteSession(...args),
}));

const authState: { isLoggedIn: boolean; username?: string } = {
  isLoggedIn: false,
};

function createContext(method: string, body?: unknown): APIContext {
  return {
    request:
      body === undefined
        ? new Request("http://localhost/api/games/score-training/session", {
            method,
          })
        : new Request("http://localhost/api/games/score-training/session", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("score-training session API route", () => {
  beforeEach(() => {
    authState.isLoggedIn = false;
    authState.username = undefined;
    mockCreateSession.mockReset();
    mockGetScoreTrainingSession.mockReset();
    mockDeleteSession.mockReset();
    mockGetSession.mockResolvedValue(authState);
  });

  it("POST returns 401 when not logged in", async () => {
    const response = await POST(
      createContext("POST", { endMode: "rounds", roundCount: 10 })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("POST returns 409 when session already exists", async () => {
    authState.isLoggedIn = true;
    authState.username = "alex";
    mockGetScoreTrainingSession.mockResolvedValue({ slug: "score-training" });

    const response = await POST(
      createContext("POST", { endMode: "rounds", roundCount: 10 })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.SESSION_EXISTS,
    });
  });

  it("POST creates session with valid settings", async () => {
    authState.isLoggedIn = true;
    authState.username = "alex";
    mockGetScoreTrainingSession.mockResolvedValue(null);
    mockCreateSession.mockResolvedValue({
      slug: "score-training",
      settings: { endMode: "rounds", roundCount: 10 },
      state: {
        currentRound: 1,
        currentScore: 0,
        status: "active",
        lastScore: null,
      },
      roundHistory: [],
      timeRemainingSeconds: null,
      createdAt: "",
      updatedAt: "",
    });

    const response = await POST(
      createContext("POST", { endMode: "rounds", roundCount: 10 })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.state.currentScore).toBe(0);
  });

  it("GET returns active session", async () => {
    authState.isLoggedIn = true;
    authState.username = "alex";
    mockGetScoreTrainingSession.mockResolvedValue({
      slug: "score-training",
      settings: { endMode: "rounds", roundCount: 10 },
      state: {
        currentRound: 2,
        currentScore: 45,
        status: "active",
        lastScore: 15,
      },
      roundHistory: [],
      timeRemainingSeconds: null,
      createdAt: "",
      updatedAt: "",
    });

    const response = await GET(createContext("GET"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.state.currentScore).toBe(45);
  });

  it("DELETE abandons session", async () => {
    authState.isLoggedIn = true;
    authState.username = "alex";
    mockDeleteSession.mockResolvedValue(undefined);

    const response = await DELETE(createContext("DELETE"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mockDeleteSession).toHaveBeenCalledWith("alex");
  });
});
