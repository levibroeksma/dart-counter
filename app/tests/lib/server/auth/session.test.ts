import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSession } from "@lib/server/auth/session";
import { TEST_USER_ID } from "@lib/server/auth/neon";

const mockProxy = vi.fn();

vi.mock("@lib/server/auth/neon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/server/auth/neon")>();
  return {
    ...actual,
    proxyAuthRequest: (...args: unknown[]) => mockProxy(...args),
  };
});

describe("getSession", () => {
  beforeEach(() => {
    mockProxy.mockReset();
  });

  it("returns logged-out session when get-session has no user", async () => {
    mockProxy.mockResolvedValue(
      new Response(JSON.stringify({ session: null, user: null }), {
        status: 200,
      })
    );

    const session = await getSession(new Request("http://localhost/"));

    expect(session).toEqual({ isLoggedIn: false });
  });

  it("maps Neon user to AppSession", async () => {
    mockProxy.mockResolvedValue(
      new Response(
        JSON.stringify({
          session: { id: "sess-1" },
          user: { id: TEST_USER_ID, email: "test@example.com", name: "Test" },
        }),
        { status: 200 }
      )
    );

    const session = await getSession(new Request("http://localhost/"));

    expect(session).toEqual({
      isLoggedIn: true,
      userId: TEST_USER_ID,
      email: "test@example.com",
      name: "Test",
    });
  });

  it("returns logged-out session on proxy failure", async () => {
    mockProxy.mockResolvedValue(new Response("error", { status: 500 }));

    const session = await getSession(new Request("http://localhost/"));

    expect(session).toEqual({ isLoggedIn: false });
  });
});
