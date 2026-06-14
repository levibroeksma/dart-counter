import { describe, it, expect } from "vitest";
import { errorParamToMessageCode } from "@lib/shared/games/errors";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("errorParamToMessageCode", () => {
  it("maps known URL error params", () => {
    expect(errorParamToMessageCode("unknown-game")).toBe(
      MessageCode.UNKNOWN_GAME
    );
    expect(errorParamToMessageCode("unavailable-game")).toBe(
      MessageCode.UNAVAILABLE_GAME
    );
  });

  it("returns null for unknown params", () => {
    expect(errorParamToMessageCode("nope")).toBeNull();
    expect(errorParamToMessageCode(null)).toBeNull();
  });
});
