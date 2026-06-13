import { describe, it, expect, vi, beforeEach } from "vitest";
import { onRequest } from "../src/middleware";

const mockNext = vi.fn(async () => new Response("ok"));
const mockRedirect = vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } }));

let sessionLoggedIn = false;

vi.mock("astro:middleware", () => ({
  defineMiddleware: <T>(fn: T) => fn,
}));

vi.mock("@lib/server/auth/session", () => ({
  getSession: vi.fn(async () => ({ isLoggedIn: sessionLoggedIn })),
}));

function createContext(pathname: string, search = "") {
  return {
    url: new URL(`http://localhost${pathname}${search}`),
    redirect: mockRedirect,
  };
}

describe("middleware", () => {
  beforeEach(() => {
    sessionLoggedIn = false;
    mockNext.mockClear();
    mockRedirect.mockClear();
  });

  it("redirects unauthenticated users on protected routes to login", async () => {
    await onRequest(createContext("/") as never, mockNext);
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

  it("passes through static assets", async () => {
    await onRequest(createContext("/favicon.svg") as never, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});
