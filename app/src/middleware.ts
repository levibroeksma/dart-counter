import { defineMiddleware } from "astro:middleware";
import { getSession } from "@lib/server/auth/session";
import { sanitizeRedirect } from "@lib/shared/utils/redirect";

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_astro/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/api/");
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, searchParams } = context.url;

  if (isPublicPath(pathname) || isStaticAsset(pathname)) {
    if (pathname === "/login") {
      const session = await getSession(context.cookies);
      if (session.isLoggedIn) {
        const redirect = sanitizeRedirect(searchParams.get("redirect"));
        return context.redirect(redirect);
      }
    }
    return next();
  }

  const session = await getSession(context.cookies);
  if (!session.isLoggedIn) {
    const redirect = encodeURIComponent(pathname);
    return context.redirect(`/login?redirect=${redirect}`);
  }

  return next();
});
