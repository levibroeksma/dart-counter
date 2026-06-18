import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../src/pages/api/auth/logout";

const mockProxy = vi.fn();

vi.mock("@lib/server/auth/neon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/server/auth/neon")>();
  return {
    ...actual,
    proxyAuthRequest: (...args: unknown[]) => mockProxy(...args),
  };
});

function createContext(): APIContext {
  return {
    request: new Request("http://localhost/api/auth/logout", { method: "POST" }),
    cookies: {} as APIContext["cookies"],
  } as APIContext;
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    mockProxy.mockReset();
    process.env.NEON_AUTH_BASE_URL = "https://test.neonauth.example/auth";
    process.env.NEON_AUTH_COOKIE_SECRET = "test-cookie-secret-at-least-32-chars";
  });

  it("proxies sign-out and forwards clearing cookies", async () => {
    mockProxy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Set-Cookie": "neon_session=; Max-Age=0; Path=/" },
      })
    );

    const response = await POST(createContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(Request),
      ["sign-out"],
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    );
    expect(response.headers.getSetCookie()).toEqual([
      "neon_session=; Max-Age=0; Path=/",
    ]);
  });
});
