import { MessageCode } from "@lib/shared/constants/errors.constants";

const ERROR_PARAM_MAP: Record<string, MessageCode> = {
  "unknown-game": MessageCode.UNKNOWN_GAME,
  "unavailable-game": MessageCode.UNAVAILABLE_GAME,
};

/**
 * Map a toast URL error param to a MessageCode, or null if unrecognized.
 */
export function errorParamToMessageCode(
  param: string | null | undefined
): MessageCode | null {
  if (!param) return null;
  return ERROR_PARAM_MAP[param] ?? null;
}
