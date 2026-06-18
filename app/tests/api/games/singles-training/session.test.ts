import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { DELETE, GET, POST } from "../../../../src/pages/api/games/singles-training/session";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockGetSession = vi.fn();
const mockCreateSinglesTrainingSession = vi.fn();
const mockGetSinglesTrainingSession = vi.fn();
const mockDeleteSinglesTrainingSession = vi.fn();

vi.mock("@lib/server/auth/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@lib/server/data/singles-training-session", () => ({
  createSinglesTrainingSession: (...args: unknown[]) =>
    mockCreateSinglesTrainingSession(...args),
  getSinglesTrainingSession: (...args: unknown[]) =>
    mockGetSinglesTrainingSession(...args),
  deleteSinglesTrainingSession: (...args: unknown[]) =>
    mockDeleteSinglesTrainingSession(...args),
}));

const authState: { isLoggedIn: boolean; userId?: string } = {
  isLoggedIn: false,
};

const settings = {
  direction: "low-to-high" as const,
  mode: "normal" as const,
  scoring: "traditional" as const,
};

const session = {
  slug: "singles-training" as const,
  settings,
  targetSequence: [1, 2, 3, "bull"] as const,
  state: {
    status: "active" as const,
    currentTargetIndex: 0,
    currentDartInVisit: 0 as const,
    score: 0,
    segmentCounts: { miss: 0, single: 0, double: 0, triple: 0 },
  },
  dartHistory: [],
  createdAt: "",
  updatedAt: "",
};

function createContext(method: string, body?: unknown): APIContext {
  return {
    request:
      body === undefined
        ? new Request("http://localhost/api/games/singles-training/session", {
            method,
          })
        : new Request("http://localhost/api/games/singles-training/session", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    cookies: {} as APIContext["cookies"],
  } as unknown as APIContext;
}

describe("singles-training session API route", () => {
  beforeEach(() => {
    authState.isLoggedIn = false;
    authState.userId = undefined;
    mockCreateSinglesTrainingSession.mockReset();
    mockGetSinglesTrainingSession.mockReset();
    mockDeleteSinglesTrainingSession.mockReset();
    mockGetSession.mockResolvedValue(authState);
  });

  it("POST returns 401 when not logged in", async () => {
    const response = await POST(createContext("POST", settings));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.UNAUTHORIZED,
    });
  });

  it("POST returns 409 when session already exists", async () => {
    authState.isLoggedIn = true;
    authState.userId = "00000000-0000-4000-8000-000000000001";
    mockGetSinglesTrainingSession.mockResolvedValue({ slug: "singles-training" });

    const response = await POST(createContext("POST", settings));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      code: MessageCode.SESSION_EXISTS,
    });
  });

  it("POST creates session with valid settings", async () => {
    authState.isLoggedIn = true;
    authState.userId = "00000000-0000-4000-8000-000000000001";
    mockGetSinglesTrainingSession.mockResolvedValue(null);
    mockCreateSinglesTrainingSession.mockResolvedValue(structuredClone(session));

    const response = await POST(createContext("POST", settings));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.slug).toBe("singles-training");
    expect(data.session.state.score).toBe(0);
  });

  it("GET returns active session", async () => {
    authState.isLoggedIn = true;
    authState.userId = "00000000-0000-4000-8000-000000000001";
    mockGetSinglesTrainingSession.mockResolvedValue(structuredClone(session));

    const response = await GET(createContext("GET"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.slug).toBe("singles-training");
  });

  it("DELETE abandons session", async () => {
    authState.isLoggedIn = true;
    authState.userId = "00000000-0000-4000-8000-000000000001";
    mockDeleteSinglesTrainingSession.mockResolvedValue(undefined);

    const response = await DELETE(createContext("DELETE"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mockDeleteSinglesTrainingSession).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });
});
