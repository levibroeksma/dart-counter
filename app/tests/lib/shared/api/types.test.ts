import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  ApiSuccess,
  ApiError,
  ApiResponse,
  PreferencesSuccess,
} from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("ApiResponse types", () => {
  it("ApiSuccess includes bare ok and preferences payload", () => {
    const bare: ApiSuccess = { ok: true };
    const prefs: PreferencesSuccess = { ok: true, displayName: "Alex" };
    expectTypeOf(bare.ok).toEqualTypeOf<true>();
    expectTypeOf(prefs.displayName).toEqualTypeOf<string | undefined>();
  });

  it("ApiError has ok: false and code", () => {
    const error: ApiError = { ok: false, code: MessageCode.MISSING_FIELDS };
    expectTypeOf(error.ok).toEqualTypeOf<false>();
    expectTypeOf(error.code).toEqualTypeOf<MessageCode>();
  });

  it("ApiResponse is a union of success and error", () => {
    const responses: ApiResponse[] = [
      { ok: true },
      { ok: true, displayName: "Alex" },
      { ok: false, code: MessageCode.INVALID_CREDENTIALS },
    ];
    expect(responses).toHaveLength(3);
  });
});
