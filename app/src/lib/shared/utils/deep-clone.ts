/**
 * Deep-clones JSON-serializable values.
 * Falls back when `structuredClone` fails (e.g. Alpine reactive proxies).
 */
export function deepClone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
