import { describe, it, expect } from "vitest";
import {
  MessageCode,
  errorMessages,
} from "@lib/shared/constants/errors.constants";

describe("errors.constants", () => {
  it("defines all required message codes", () => {
    expect(MessageCode.INVALID_CREDENTIALS).toBe("INVALID_CREDENTIALS");
    expect(MessageCode.MISSING_FIELDS).toBe("MISSING_FIELDS");
    expect(MessageCode.SERVER_CONFIG).toBe("SERVER_CONFIG");
    expect(MessageCode.NETWORK_ERROR).toBe("NETWORK_ERROR");
  });

  it("has a message for every code", () => {
    const codes = Object.values(MessageCode);
    for (const code of codes) {
      expect(errorMessages[code]).toBeTypeOf("string");
      expect(errorMessages[code].length).toBeGreaterThan(0);
    }
  });

  it("maps codes to expected English messages", () => {
    expect(errorMessages[MessageCode.INVALID_CREDENTIALS]).toBe(
      "Invalid username or password"
    );
    expect(errorMessages[MessageCode.MISSING_FIELDS]).toBe(
      "Username and password are required"
    );
    expect(errorMessages[MessageCode.SERVER_CONFIG]).toBe(
      "Server configuration error"
    );
    expect(errorMessages[MessageCode.NETWORK_ERROR]).toBe(
      "Unable to connect. Please try again."
    );
  });
});
