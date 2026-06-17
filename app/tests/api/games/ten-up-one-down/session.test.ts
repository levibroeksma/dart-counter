import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { GET, POST, DELETE } from "../../../../src/pages/api/games/ten-up-one-down/session";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetSession = vi.fn();
const mockCreateSession = vi.fn();
const mockGetTuodSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/ten-up-one-down-session", () => ({
  createTenUpOneDownSession: (...args: unknown[]) => mockCreateSession(...args),
  getTenUpOneDownSession: (...args: unknown[]) => mockGetTuodSession(...args),
  deleteTenUpOneDownSession: (...args: unknown[]) => mockDeleteSession(...args),
}));

const authState: { isLoggedIn: boolean; username?: string } = {
  isLoggedIn: false,
};

function createContext(method: string, body?: unknown): APIContext {
  return {
    request:
      body === undefined
        ? new Request("http://localhost/api/games/ten-up-one-down/session", {
            method,
          })
        : new Request("http://localhost/api/games/ten-up-one-down/session", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("ten-up-one-down session API route", () => {
  beforeEach(() => {
    authState.isLoggedIn = false;
    authState.username = undefined;
    mockCreateSession.mockReset();
    mockGetTuodSession.mockReset();
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

  it("POST creates session with valid settings", async () => {
    authState.isLoggedIn = true;
    authState.username = "alex";
    mockGetTuodSession.mockResolvedValue(null);
    mockCreateSession.mockResolvedValue({
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
      createdAt: "",
      updatedAt: "",
    });

    const response = await POST(
      createContext("POST", { endMode: "rounds", roundCount: 10 })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.state.currentTarget).toBe(41);
  });

  it("POST returns 409 when session already exists", async () => {
    authState.isLoggedIn = true;
    authState.username = "alex";
    mockGetTuodSession.mockResolvedValue({ slug: "ten-up-one-down" });

    const response = await POST(
      createContext("POST", { endMode: "rounds", roundCount: 10 })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.SESSION_EXISTS,
    });
  });

  it("GET returns 404 when no session", async () => {
    authState.isLoggedIn = true;
    authState.username = "alex";
    mockGetTuodSession.mockResolvedValue(null);

    const response = await GET(createContext("GET"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.NO_ACTIVE_SESSION,
    });
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
