import type { TenUpOneDownGameState, TenUpOneDownSession } from "./types";

/**
 * Runtime guard for persisted session documents (rejects legacy config-only shapes).
 */
export function isTenUpOneDownSession(value: unknown): value is TenUpOneDownSession {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  const state = record.state;

  return (
    record.slug === "ten-up-one-down" &&
    state !== null &&
    typeof state === "object" &&
    typeof (state as TenUpOneDownGameState).currentTarget === "number" &&
    Array.isArray(record.roundHistory) &&
    record.settings !== null &&
    typeof record.settings === "object"
  );
}
