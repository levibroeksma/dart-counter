import type { AstroCookies } from "astro";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "",
  cookieName: "dart-counter-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
};

export async function getSession(cookies: AstroCookies) {
  return getIronSession<SessionData>(cookies, sessionOptions);
}
