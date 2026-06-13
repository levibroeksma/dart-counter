import type { MessageCode } from "@lib/shared/constants/errors.constants";

export type PreferencesSuccess = { ok: true; displayName?: string };
export type ApiSuccess = { ok: true } | PreferencesSuccess;
export type ApiError = { ok: false; code: MessageCode };
export type ApiResponse = ApiSuccess | ApiError;
