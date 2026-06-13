import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../src/pages/api/auth/logout";

const mockDestroy = vi.fn();
const mockSession = { isLoggedIn: true, destroy: mockDestroy };

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => mockSession),
}));

function createContext(): APIContext {
  return {
    request: new Request("http://localhost/api/auth/logout", { method: "POST" }),
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    mockDestroy.mockClear();
    mockSession.isLoggedIn = true;
  });

  it("destroys session and returns ok: true", async () => {
    const response = await POST(createContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockDestroy).toHaveBeenCalledOnce();
  });
});
