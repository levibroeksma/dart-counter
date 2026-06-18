import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { proxyNeonAuthUpstream } from "@lib/server/auth/neon-proxy";

const BASE_URL = "https://test.neonauth.example/auth";

describe("proxyNeonAuthUpstream", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards Neon Auth cookies and POST body to upstream URL", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const request = new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie:
          "__Secure-neon-auth.session_token=abc; other=value; __Secure-neon-auth.local.session_data=xyz",
      },
      body: JSON.stringify({ email: "a@b.com", password: "secret" }),
    });

    await proxyNeonAuthUpstream(request, "sign-in/email", { baseUrl: BASE_URL });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/sign-in/email`);
    expect(init.method).toBe("POST");
    const upstreamHeaders = new Headers(init.headers);
    expect(upstreamHeaders.get("content-type")).toBe("application/json");
    expect(upstreamHeaders.get("cookie")).toBe(
      "__Secure-neon-auth.session_token=abc; __Secure-neon-auth.local.session_data=xyz"
    );
    expect(init.body).toBe(JSON.stringify({ email: "a@b.com", password: "secret" }));
  });

  it("passes Set-Cookie headers from upstream to client response", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ session: {}, user: {} }), {
        status: 200,
        headers: {
          "Set-Cookie":
            "__Secure-neon-auth.session_token=tok; Path=/; HttpOnly; Secure",
        },
      })
    );

    const request = new Request("http://localhost/api/auth/get-session", {
      method: "GET",
    });

    const response = await proxyNeonAuthUpstream(request, "get-session", {
      baseUrl: BASE_URL,
    });

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual([
      "__Secure-neon-auth.session_token=tok; Path=/; HttpOnly; Secure",
    ]);
  });

  it("returns 502 JSON on upstream network failure", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));

    const request = new Request("http://localhost/api/auth/get-session", {
      method: "GET",
    });

    const response = await proxyNeonAuthUpstream(request, "get-session", {
      baseUrl: BASE_URL,
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.code).toBe("NETWORK_ERROR");
  });
});
