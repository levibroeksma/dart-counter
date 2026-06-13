import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
    },
  },
});
