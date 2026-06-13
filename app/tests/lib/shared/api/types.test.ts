import { describe, it, expect, expectTypeOf } from "vitest";
import type { ApiSuccess, ApiError, ApiResponse } from "@lib/shared/api/types";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("ApiResponse types", () => {
  it("ApiSuccess has ok: true only", () => {
    const success: ApiSuccess = { ok: true };
    expectTypeOf(success.ok).toEqualTypeOf<true>();
  });

  it("ApiError has ok: false and code", () => {
    const error: ApiError = { ok: false, code: MessageCode.MISSING_FIELDS };
    expectTypeOf(error.ok).toEqualTypeOf<false>();
    expectTypeOf(error.code).toEqualTypeOf<MessageCode>();
  });

  it("ApiResponse is a union of success and error", () => {
    const responses: ApiResponse[] = [
      { ok: true },
      { ok: false, code: MessageCode.INVALID_CREDENTIALS },
    ];
    expect(responses).toHaveLength(2);
  });
});
