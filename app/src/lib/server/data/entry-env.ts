import { and, eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getEntryEnv } from "@lib/shared/constants/entry-env";

/**
 * Drizzle filter matching the current runtime entry_env.
 */
function entryEnvEq(column: AnyPgColumn): SQL {
  return eq(column, getEntryEnv());
}

/**
 * Combines entry_env scoping with additional where clauses.
 */
export function withEntryEnv(
  column: AnyPgColumn,
  ...conditions: (SQL | undefined)[]
): SQL {
  return and(entryEnvEq(column), ...conditions.filter(Boolean))!;
}
