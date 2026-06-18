/// <reference types="vitest/config" />
import path from "node:path";
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    env: {
      NEON_AUTH_BASE_URL: "https://test.neonauth.example/auth",
      NEON_AUTH_COOKIE_SECRET: "test-cookie-secret-at-least-32-chars",
      NODE_ENV: "test",
      ENTRY_ENV: "dev",
    },
  },
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@icons": path.resolve(__dirname, "./src/icons"),
      "@db": path.resolve(__dirname, "./db"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
});
