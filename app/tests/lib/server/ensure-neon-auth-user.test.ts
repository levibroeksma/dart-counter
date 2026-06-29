import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEV_AUTH_DEFAULTS,
  ensureNeonAuthUser,
} from "@lib/server/ensure-neon-auth-user";

describe("ensureNeonAuthUser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.SEED_AUTH_EMAIL;
    delete process.env.SEED_AUTH_PASSWORD;
  });

  it("returns ready when sign-in succeeds", async () => {
    process.env.NEON_AUTH_BASE_URL = "https://auth.example.test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    await expect(ensureNeonAuthUser()).resolves.toBe("ready");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("returns created when sign-in fails and sign-up succeeds", async () => {
    process.env.NEON_AUTH_BASE_URL = "https://auth.example.test";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({ ok: true, status: 200 }),
    );

    await expect(ensureNeonAuthUser()).resolves.toBe("created");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws when user exists with a different password", async () => {
    process.env.NEON_AUTH_BASE_URL = "https://auth.example.test";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({
          ok: false,
          status: 422,
          text: async () =>
            JSON.stringify({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }),
        }),
    );

    await expect(ensureNeonAuthUser()).rejects.toThrow(
      "password does not match",
    );
  });

  it("uses dev defaults for email and password", () => {
    expect(DEV_AUTH_DEFAULTS.email).toBe("test@example.com");
    expect(DEV_AUTH_DEFAULTS.password).toBe("testpass");
  });
});
