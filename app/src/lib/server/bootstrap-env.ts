import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

/**
 * Parse a single .env file into process.env for keys not already set.
 */
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

/**
 * Load .env into process.env for local dev when secrets are not already set.
 * Production (Netlify) provides env vars at runtime; tests set them via vitest.config.
 */
export function bootstrapEnv(): void {
  if (loaded) return;
  if (process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET) {
    loaded = true;
    return;
  }

  const cwd = process.cwd();
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";

  loadEnvFile(resolve(cwd, ".env"));
  loadEnvFile(resolve(cwd, ".env.local"));
  loadEnvFile(resolve(cwd, `.env.${mode}`));
  loadEnvFile(resolve(cwd, `.env.${mode}.local`));

  loaded = true;
}
