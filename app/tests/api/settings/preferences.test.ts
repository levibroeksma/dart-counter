import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { GET, PUT } from "../../../src/pages/api/settings/preferences";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { TEST_USER_ID } from "@tests/helpers/constants";

const mockGetPreferences = vi.fn();
const mockSetPreferences = vi.fn();

vi.mock("@lib/server/data/preferences", () => ({
  getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
  setPreferences: (...args: unknown[]) => mockSetPreferences(...args),
}));

const mockSession: { isLoggedIn: boolean; userId?: string } = {
  isLoggedIn: false,
};

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => mockSession),
}));

function createGetContext(): APIContext {
  return {
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

function createPutContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

describe("GET /api/settings/preferences", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockSession.userId = undefined;
    mockGetPreferences.mockReset();
  });

  it("returns 401 when not logged in", async () => {
    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns stored display name when logged in", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = TEST_USER_ID;
    mockGetPreferences.mockResolvedValue({ displayName: "Alex" });

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, displayName: "Alex" });
    expect(mockGetPreferences).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("returns 500 when database read fails", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = TEST_USER_ID;
    mockGetPreferences.mockRejectedValue(new Error("db down"));

    const response = await GET(createGetContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_ERROR });
  });
});

describe("PUT /api/settings/preferences", () => {
  beforeEach(() => {
    mockSession.isLoggedIn = false;
    mockSession.userId = undefined;
    mockSetPreferences.mockReset();
  });

  it("returns 401 when not logged in", async () => {
    const response = await PUT(createPutContext({ displayName: "Alex" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.UNAUTHORIZED });
  });

  it("returns 400 for invalid display name", async () => {
    mockSession.isLoggedIn = true;

    const response = await PUT(createPutContext({ displayName: "A" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.INVALID_DISPLAY_NAME });
    expect(mockSetPreferences).not.toHaveBeenCalled();
  });

  it("saves valid display name", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = TEST_USER_ID;

    const response = await PUT(createPutContext({ displayName: "  Alex  " }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, displayName: "Alex" });
    expect(mockSetPreferences).toHaveBeenCalledWith(TEST_USER_ID, {
      displayName: "Alex",
    });
  });

  it("clears display name when empty", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = TEST_USER_ID;

    const response = await PUT(createPutContext({ displayName: "   " }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockSetPreferences).toHaveBeenCalledWith(TEST_USER_ID, {});
  });

  it("returns 500 when database write fails", async () => {
    mockSession.isLoggedIn = true;
    mockSession.userId = TEST_USER_ID;
    mockSetPreferences.mockRejectedValue(new Error("db down"));

    const response = await PUT(createPutContext({ displayName: "Alex" }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_ERROR });
  });
});
