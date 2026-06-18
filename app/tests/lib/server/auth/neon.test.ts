import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forwardSetCookieHeaders, proxyAuthRequest } from "@lib/server/auth/neon";

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
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proxies POST to upstream sign-in/email", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
    });
    const response = await proxyAuthRequest(request, ["sign-in", "email"], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "secret" }),
    });

    expect(response.status).toBe(200);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://test.neonauth.example/auth/sign-in/email");
  });

  it("throws SERVER_CONFIG when env is missing", async () => {
    delete process.env.NEON_AUTH_COOKIE_SECRET;

    const request = new Request("http://localhost/", { method: "GET" });

    await expect(proxyAuthRequest(request, ["get-session"])).rejects.toThrow(
      "SERVER_CONFIG"
    );
  });
});
