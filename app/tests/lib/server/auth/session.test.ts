import { describe, it, expect } from "vitest";
import {
  sessionOptions,
  SESSION_MAX_AGE_SECONDS,
  type SessionData,
} from "@lib/server/auth/session";

describe("session", () => {
  it("defines SessionData with isLoggedIn boolean", () => {
    const data: SessionData = { isLoggedIn: false };
    expect(data.isLoggedIn).toBe(false);
  });

  it("uses SESSION_SECRET from process.env", () => {
    expect(sessionOptions.password).toBe(
      "test-secret-that-is-at-least-32-chars-long"
    );
  });

  it("sets 30-day maxAge", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30);
    expect(sessionOptions.cookieOptions.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("configures secure httpOnly sameSite=lax cookie", () => {
    expect(sessionOptions.cookieOptions.httpOnly).toBe(true);
    expect(sessionOptions.cookieOptions.sameSite).toBe("lax");
    expect(sessionOptions.cookieOptions.secure).toBe(false);
  });

  it("uses dart-counter-session cookie name", () => {
    expect(sessionOptions.cookieName).toBe("dart-counter-session");
  });
});
