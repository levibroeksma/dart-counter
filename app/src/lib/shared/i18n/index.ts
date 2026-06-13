import {
  errorMessages,
  type MessageCode,
} from "@lib/shared/constants/errors.constants";

/**
 * Resolve a message code to a user-facing string.
 * Locale switch added when a second language is introduced.
 */
export function t(code: MessageCode, locale = "en"): string {
  void locale;
  return errorMessages[code];
}
