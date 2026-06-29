/**
 * Returns an RFC 4122 v4 UUID.
 * Falls back when `crypto.randomUUID` is unavailable (e.g. HTTP dev server on a LAN IP).
 */
export function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function" &&
    globalThis.isSecureContext
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
