import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

/**
 * Parse a single .env file into process.env.
 * @param override When true, later files replace existing keys (e.g. .env.local).
 */
function loadEnvFile(filePath: string, override = false): void {
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

    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * Load .env into process.env for local dev when secrets are not already set.
 * Production (Netlify) provides env vars at runtime; tests set them via vitest.config.
 * Local override files are re-applied on every call so dev-branch credentials win
 * over values injected later (e.g. Vite env loading or a switched Neon branch).
 */
export function bootstrapEnv(): void {
  const cwd = process.cwd();
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";

  if (!loaded) {
    loadEnvFile(resolve(cwd, ".env"));
    loadEnvFile(resolve(cwd, `.env.${mode}`));
    loaded = true;
  }

  loadEnvFile(resolve(cwd, ".env.local"), true);
  loadEnvFile(resolve(cwd, `.env.${mode}.local`), true);
}
