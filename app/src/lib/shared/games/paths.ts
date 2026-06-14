/**
 * Build the per-game settings route path.
 */
export function settingsPath(slug: string): string {
  return `/games/settings-${slug}`;
}

/**
 * Build the per-game play route path.
 */
export function playPath(slug: string): string {
  return `/games/${slug}`;
}
