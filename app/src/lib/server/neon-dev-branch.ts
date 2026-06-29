const MAX_BRANCH_NAME_LENGTH = 63;

/**
 * Map a git branch name to a Neon branch name for local dev isolation.
 */
export function resolveNeonDevBranchName(
  gitBranch: string | null | undefined,
): string {
  const trimmed = gitBranch?.trim();
  if (!trimmed || trimmed === "main" || trimmed === "master") {
    return "dev";
  }

  const sanitized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!sanitized) return "dev";
  return sanitized.slice(0, MAX_BRANCH_NAME_LENGTH);
}
