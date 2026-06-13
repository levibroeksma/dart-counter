import type { MessageCode } from "@lib/shared/constants/errors.constants";

export type ApiSuccess = { ok: true };
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
