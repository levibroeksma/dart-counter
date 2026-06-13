import { describe, it, expect } from "vitest";
import { t } from "@lib/shared/i18n";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("t()", () => {
  it("returns English message for INVALID_CREDENTIALS", () => {
    expect(t(MessageCode.INVALID_CREDENTIALS)).toBe(
      "Invalid username or password"
    );
  });

  it("returns English message for MISSING_FIELDS", () => {
    expect(t(MessageCode.MISSING_FIELDS)).toBe(
      "Username and password are required"
    );
  });

  it("defaults to English locale", () => {
    expect(t(MessageCode.NETWORK_ERROR, "en")).toBe(
      "Unable to connect. Please try again."
    );
  });
});
