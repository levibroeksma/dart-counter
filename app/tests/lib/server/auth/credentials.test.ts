import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertAuthConfig,
  validateCredentials,
} from "@lib/server/auth/credentials";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("credentials", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("assertAuthConfig", () => {
    it("does not throw when all env vars are set", () => {
      expect(() => assertAuthConfig()).not.toThrow();
    });

    it("throws SERVER_CONFIG when AUTH_USERNAME is missing", () => {
      delete process.env.AUTH_USERNAME;
      expect(() => assertAuthConfig()).toThrow(MessageCode.SERVER_CONFIG);
    });

    it("throws SERVER_CONFIG when SESSION_SECRET is missing", () => {
      delete process.env.SESSION_SECRET;
      expect(() => assertAuthConfig()).toThrow(MessageCode.SERVER_CONFIG);
    });
  });

  describe("validateCredentials", () => {
    beforeEach(() => {
      process.env.AUTH_USERNAME = "testuser";
      process.env.AUTH_PASSWORD = "testpass";
    });

    it("returns true for matching credentials", () => {
      expect(validateCredentials("testuser", "testpass")).toBe(true);
    });

    it("returns false for wrong username", () => {
      expect(validateCredentials("wrong", "testpass")).toBe(false);
    });

    it("returns false for wrong password", () => {
      expect(validateCredentials("testuser", "wrong")).toBe(false);
    });
  });
});
