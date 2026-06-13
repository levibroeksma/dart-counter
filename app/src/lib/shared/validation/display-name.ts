import { MessageCode } from "@lib/shared/constants/errors.constants";

export type ValidateDisplayNameResult =
  | { valid: true; value: string }
  | { valid: false; code: typeof MessageCode.INVALID_DISPLAY_NAME };

/**
 * Validate and normalize a display name.
 * Empty after trim clears the preference; non-empty must be 2–20 characters.
 */
export function validateDisplayName(raw: string): ValidateDisplayNameResult {
  const value = raw.trim();

  if (value.length === 0) {
    return { valid: true, value: "" };
  }

  if (value.length < 2 || value.length > 20) {
    return { valid: false, code: MessageCode.INVALID_DISPLAY_NAME };
  }

  return { valid: true, value };
}
