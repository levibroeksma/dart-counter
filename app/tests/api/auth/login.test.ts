import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../src/pages/api/auth/login";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockSave = vi.fn();
const mockSession: { isLoggedIn: boolean; username?: string; save: typeof mockSave } = {
  isLoggedIn: false,
  save: mockSave,
};

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => mockSession),
}));

function createContext(body: unknown): APIContext {
  return {
    request: new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockSession.isLoggedIn = false;
    delete mockSession.username;
    process.env.AUTH_USERNAME = "testuser";
    process.env.AUTH_PASSWORD = "testpass";
    process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-chars-long";
  });

  it("returns 200 and sets session for valid credentials", async () => {
    const response = await POST(createContext({ username: "testuser", password: "testpass" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockSession.isLoggedIn).toBe(true);
    expect(mockSession.username).toBe("testuser");
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it("returns 401 for invalid credentials", async () => {
    const response = await POST(createContext({ username: "wrong", password: "wrong" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.INVALID_CREDENTIALS });
    expect(mockSession.isLoggedIn).toBe(false);
  });

  it("returns 400 when username is missing", async () => {
    const response = await POST(createContext({ password: "testpass" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.MISSING_FIELDS });
  });

  it("returns 400 when password is missing", async () => {
    const response = await POST(createContext({ username: "testuser" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.MISSING_FIELDS });
  });

  it("returns 500 when env vars are missing", async () => {
    delete process.env.SESSION_SECRET;
    const response = await POST(createContext({ username: "testuser", password: "testpass" }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_CONFIG });
  });
});
