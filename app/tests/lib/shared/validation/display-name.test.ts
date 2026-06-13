import { describe, it, expect } from "vitest";
import { validateDisplayName } from "@lib/shared/validation/display-name";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("validateDisplayName", () => {
  it("accepts empty string after trim as clear", () => {
    expect(validateDisplayName("   ")).toEqual({ valid: true, value: "" });
  });

  it("accepts names between 2 and 20 characters", () => {
    expect(validateDisplayName("Al")).toEqual({ valid: true, value: "Al" });
    expect(validateDisplayName("  Alex  ")).toEqual({
      valid: true,
      value: "Alex",
    });
    expect(validateDisplayName("a".repeat(20))).toEqual({
      valid: true,
      value: "a".repeat(20),
    });
  });

  it("rejects names shorter than 2 characters", () => {
    expect(validateDisplayName("A")).toEqual({
      valid: false,
      code: MessageCode.INVALID_DISPLAY_NAME,
    });
  });

  it("rejects names longer than 20 characters", () => {
    expect(validateDisplayName("a".repeat(21))).toEqual({
      valid: false,
      code: MessageCode.INVALID_DISPLAY_NAME,
    });
  });
});
