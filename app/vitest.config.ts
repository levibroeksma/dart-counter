/// <reference types="vitest/config" />
import path from "node:path";
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      AUTH_USERNAME: "testuser",
      AUTH_PASSWORD: "testpass",
      SESSION_SECRET: "test-secret-that-is-at-least-32-chars-long",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@icons": path.resolve(__dirname, "./src/icons"),
    },
  },
});
