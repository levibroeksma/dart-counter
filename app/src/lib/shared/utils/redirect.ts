/**
 * Sanitize a post-login redirect target. Only same-origin relative paths allowed.
 */
export function sanitizeRedirect(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}
