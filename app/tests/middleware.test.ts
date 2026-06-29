import { describe, it, expect, vi, beforeEach } from "vitest";
import { onRequest } from "../src/middleware";
import { getSession } from "@lib/server/auth/session";

const mockNext = vi.fn(async () => new Response("ok"));
const mockRedirect = vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } }));

let sessionLoggedIn = false;

vi.mock("astro:middleware", () => ({
  defineMiddleware: <T>(fn: T) => fn,
}));

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => ({ isLoggedIn: sessionLoggedIn })),
}));

const mockGetSession = vi.mocked(getSession);

function createContext(pathname: string, search = "") {
  const locals: App.Locals = {};
  return {
    url: new URL(`http://localhost${pathname}${search}`),
    request: new Request(`http://localhost${pathname}${search}`),
    redirect: mockRedirect,
    locals,
  };
}

describe("middleware", () => {
  beforeEach(() => {
    sessionLoggedIn = false;
    mockNext.mockClear();
    mockRedirect.mockClear();
    mockGetSession.mockReset();
    mockGetSession.mockImplementation(async () => ({ isLoggedIn: sessionLoggedIn }));
  });

  it("redirects unauthenticated users on protected routes to login", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });

    const ctx = createContext("/");
    await onRequest(ctx as never, mockNext);

    expect(mockRedirect).toHaveBeenCalledWith("/login?redirect=%2F");
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("allows unauthenticated access to /login", async () => {
    await onRequest(createContext("/login") as never, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("allows unauthenticated access to /api/auth/login", async () => {
    await onRequest(createContext("/api/auth/login") as never, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it("redirects logged-in users away from /login", async () => {
    sessionLoggedIn = true;
    await onRequest(createContext("/login", "?redirect=/games") as never, mockNext);
    expect(mockRedirect).toHaveBeenCalledWith("/games");
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("redirects logged-in users from /login to / when no redirect param", async () => {
    sessionLoggedIn = true;
    await onRequest(createContext("/login") as never, mockNext);
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("allows logged-in users on protected routes", async () => {
    sessionLoggedIn = true;
    await onRequest(createContext("/") as never, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("stores session on locals for logged-in protected routes", async () => {
    sessionLoggedIn = true;
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      userId: "user-123",
      email: "a@b.com",
      name: "Alex",
    });

    const ctx = createContext("/games");
    await onRequest(ctx as never, mockNext);

    expect(mockGetSession).toHaveBeenCalledOnce();
    expect(ctx.locals.session).toEqual({
      isLoggedIn: true,
      userId: "user-123",
      email: "a@b.com",
      name: "Alex",
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it("does not set locals.session when unauthenticated on protected routes", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });

    const ctx = createContext("/");
    await onRequest(ctx as never, mockNext);

    expect(ctx.locals.session).toBeUndefined();
    expect(mockRedirect).toHaveBeenCalledWith("/login?redirect=%2F");
  });

  it("passes through static assets", async () => {
    await onRequest(createContext("/favicon.svg") as never, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});
