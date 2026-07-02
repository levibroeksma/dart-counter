export const ENTRY_ENV = {
  DEV: "dev",
  PROD: "prod",
} as const;

export type EntryEnv = (typeof ENTRY_ENV)[keyof typeof ENTRY_ENV];

/** Shared catalog rows are always stored as prod. */
export const CATALOG_ENTRY_ENV = ENTRY_ENV.PROD;

/**
 * Returns the environment tag for database rows in the current runtime.
 * Override with ENTRY_ENV=dev|prod when needed (e.g. Netlify preview).
 */
export function getEntryEnv(): EntryEnv {
  const override = process.env.ENTRY_ENV;
  if (override === ENTRY_ENV.DEV || override === ENTRY_ENV.PROD) {
    return override;
  }
  const isProd =
    typeof import.meta.env !== "undefined" && Boolean(import.meta.env.PROD);
  return isProd ? ENTRY_ENV.PROD : ENTRY_ENV.DEV;
}
