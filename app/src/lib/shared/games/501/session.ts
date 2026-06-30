import type { FiveOhOneSession } from "./types";

export function isFiveOhOneSession(value: unknown): value is FiveOhOneSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.slug === "501" &&
    Array.isArray(record.visitHistory) &&
    record.settings !== null &&
    typeof record.settings === "object" &&
    record.state !== null &&
    typeof record.state === "object"
  );
}
