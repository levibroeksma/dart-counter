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
    const cookieOptions = sessionOptions.cookieOptions!;
    expect(cookieOptions.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("configures secure httpOnly sameSite=lax cookie", () => {
    const cookieOptions = sessionOptions.cookieOptions!;
    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.sameSite).toBe("lax");
    expect(cookieOptions.secure).toBe(false);
  });

  it("uses dart-counter-session cookie name", () => {
    expect(sessionOptions.cookieName).toBe("dart-counter-session");
  });
});
