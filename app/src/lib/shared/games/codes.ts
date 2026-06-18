const GAME_CODES: Partial<Record<string, string>> = {
  "ten-up-one-down": "tuod",
  "singles-training": "st",
};

/**
 * Returns the lowercase game code for a slug, if registered.
 */
export function getGameCode(slug: string): string | undefined {
  return GAME_CODES[slug];
}

/**
 * Formats a stored game code for display (uppercase).
 */
export function formatGameCode(code: string): string {
  return code.toUpperCase();
}
