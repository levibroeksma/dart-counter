import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  forwardSetCookieHeaders,
  proxyAuthRequest,
  getAuthHandler,
} from "@lib/server/auth/neon";

vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: vi.fn(() => ({
    POST: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    handler: vi.fn(() => ({
      POST: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    })),
  })),
}));

describe("forwardSetCookieHeaders", () => {
  it("copies Set-Cookie headers onto the target response", () => {
    const source = new Response(null, {
      headers: { "Set-Cookie": "session=abc; Path=/; HttpOnly" },
    });
    const target = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    const merged = forwardSetCookieHeaders(source, target);

    expect(merged.status).toBe(200);
    expect(merged.headers.get("Content-Type")).toBe("application/json");
    expect(merged.headers.getSetCookie()).toEqual([
      "session=abc; Path=/; HttpOnly",
    ]);
  });
});

describe("proxyAuthRequest", () => {
  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = "https://test.neonauth.example/auth";
    process.env.NEON_AUTH_COOKIE_SECRET = "test-cookie-secret-at-least-32-chars";
  });

  it("routes POST to authApiHandler with path segments", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
    });
    const response = await proxyAuthRequest(request, ["sign-in", "email"], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "secret" }),
    });

    expect(response.status).toBe(200);
    const handler = getAuthHandler();
    expect(handler.POST).toHaveBeenCalledOnce();
  });
});
