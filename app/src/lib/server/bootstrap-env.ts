import { loadEnv } from "vite";

let loaded = false;

/**
 * Load .env into process.env for local dev when secrets are not already set.
 * Production (Netlify) provides env vars at runtime; tests set them via vitest.config.
 */
export function bootstrapEnv(): void {
  if (loaded) return;
  if (
    process.env.SESSION_SECRET &&
    process.env.AUTH_USERNAME &&
    process.env.AUTH_PASSWORD
  ) {
    loaded = true;
    return;
  }

  const env = loadEnv(
    process.env.NODE_ENV === "production" ? "production" : "development",
    process.cwd(),
    ""
  );
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) process.env[key] = value;
  }
  loaded = true;
}
