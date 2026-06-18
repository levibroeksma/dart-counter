import { describe, it, expect, beforeEach, vi } from "vitest";
import type { APIContext } from "astro";
import { POST } from "../../../src/pages/api/auth/login";
import { MessageCode } from "@lib/shared/constants/errors.constants";

const mockProxy = vi.fn();

vi.mock("@lib/server/auth/neon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/server/auth/neon")>();
  return {
    ...actual,
    proxyAuthRequest: (...args: unknown[]) => mockProxy(...args),
  };
});

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
    mockProxy.mockReset();
    process.env.NEON_AUTH_BASE_URL = "https://test.neonauth.example/auth";
    process.env.NEON_AUTH_COOKIE_SECRET = "test-cookie-secret-at-least-32-chars";
  });

  it("returns 200 and forwards Set-Cookie on success", async () => {
    mockProxy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Set-Cookie": "neon_session=abc; Path=/; HttpOnly" },
      })
    );

    const response = await POST(
      createContext({ email: "test@example.com", password: "testpass" })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(response.headers.getSetCookie()).toEqual([
      "neon_session=abc; Path=/; HttpOnly",
    ]);
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(Request),
      ["sign-in", "email"],
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns 401 for invalid credentials", async () => {
    mockProxy.mockResolvedValue(
      new Response(JSON.stringify({ error: "bad" }), { status: 401 })
    );

    const response = await POST(
      createContext({ email: "wrong@example.com", password: "wrong" })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, code: MessageCode.INVALID_CREDENTIALS });
  });

  it("returns 400 when email is missing", async () => {
    const response = await POST(createContext({ password: "testpass" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.MISSING_FIELDS });
  });

  it("returns 400 when password is missing", async () => {
    const response = await POST(createContext({ email: "test@example.com" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, code: MessageCode.MISSING_FIELDS });
  });

  it("returns 500 when Neon auth env is missing", async () => {
    delete process.env.NEON_AUTH_COOKIE_SECRET;
    const response = await POST(
      createContext({ email: "test@example.com", password: "testpass" })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.SERVER_CONFIG });
  });

  it("returns 500 when Neon is unreachable", async () => {
    mockProxy.mockRejectedValue(new Error("network"));

    const response = await POST(
      createContext({ email: "test@example.com", password: "testpass" })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ ok: false, code: MessageCode.NETWORK_ERROR });
  });
});
