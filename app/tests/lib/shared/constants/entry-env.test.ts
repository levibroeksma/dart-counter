import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTRY_ENV, getEntryEnv } from "@lib/shared/constants/entry-env";

describe("getEntryEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns dev in non-production runtimes by default", () => {
    vi.stubEnv("ENTRY_ENV", "");
    expect(getEntryEnv()).toBe(ENTRY_ENV.DEV);
  });

  it("honours ENTRY_ENV override", () => {
    vi.stubEnv("ENTRY_ENV", ENTRY_ENV.PROD);
    expect(getEntryEnv()).toBe(ENTRY_ENV.PROD);
  });
});
