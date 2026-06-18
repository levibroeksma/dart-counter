import { vi } from "vitest";
import { userPreferences, gameCatalog, userGamePlayCounts } from "@db/schema";

type UserPreferencesRow = typeof userPreferences.$inferSelect;
type GameCatalogRow = typeof gameCatalog.$inferSelect;
type UserGamePlayCountsRow = typeof userGamePlayCounts.$inferSelect;

const tables = {
  userPreferences: new Map<string, UserPreferencesRow>(),
  gameCatalog: new Map<string, GameCatalogRow>(),
  userGamePlayCounts: new Map<string, UserGamePlayCountsRow>(),
};

export const mockDb = {
  tables,
  reset() {
    tables.userPreferences.clear();
    tables.gameCatalog.clear();
    tables.userGamePlayCounts.clear();
  },
};

function playCountKey(userId: string, gameSlug: string): string {
  return `${userId}:${gameSlug}`;
}

function extractEqValue(filter: unknown): string | undefined {
  const visit = (node: unknown): string | undefined => {
    if (typeof node === "string") {
      return node;
    }
    if (!node || typeof node !== "object") return undefined;

    if ("value" in node) {
      const value = (node as { value: unknown }).value;
      if (typeof value === "string") {
        return value;
      }
    }

    if ("queryChunks" in node) {
      for (const chunk of (node as { queryChunks: unknown[] }).queryChunks) {
        const found = visit(chunk);
        if (found) return found;
      }
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found) return found;
      }
    }

    return undefined;
  };

  return visit(filter);
}

function isSqlExpression(val: unknown): boolean {
  return val !== null && typeof val === "object" && "queryChunks" in val;
}

function getTableRows(table: unknown): unknown[] {
  if (table === userPreferences) return [...tables.userPreferences.values()];
  if (table === gameCatalog) return [...tables.gameCatalog.values()];
  if (table === userGamePlayCounts) return [...tables.userGamePlayCounts.values()];
  return [];
}

function filterRowsByEq(table: unknown, filter: unknown): unknown[] {
  const eqValue = extractEqValue(filter);
  if (!eqValue) return getTableRows(table);

  if (table === userPreferences) {
    const row = tables.userPreferences.get(eqValue);
    return row ? [row] : [];
  }

  if (table === userGamePlayCounts) {
    return [...tables.userGamePlayCounts.values()].filter(
      (row) => row.userId === eqValue,
    );
  }

  return getTableRows(table);
}

function insertRows(table: unknown, rows: unknown | unknown[]): void {
  const list = Array.isArray(rows) ? rows : [rows];
  if (table === userPreferences) {
    for (const row of list as UserPreferencesRow[]) {
      tables.userPreferences.set(row.userId, row);
    }
  } else if (table === gameCatalog) {
    for (const row of list as GameCatalogRow[]) {
      tables.gameCatalog.set(row.slug, row);
    }
  } else if (table === userGamePlayCounts) {
    for (const row of list as UserGamePlayCountsRow[]) {
      tables.userGamePlayCounts.set(
        playCountKey(row.userId, row.gameSlug),
        row,
      );
    }
  }
}

function upsertRow(
  table: unknown,
  row: unknown,
  set: Record<string, unknown>,
): void {
  if (table === userPreferences) {
    const r = row as UserPreferencesRow;
    tables.userPreferences.set(r.userId, { ...r, ...set } as UserPreferencesRow);
  } else if (table === gameCatalog) {
    const r = row as GameCatalogRow;
    tables.gameCatalog.set(r.slug, { ...r, ...set } as GameCatalogRow);
  } else if (table === userGamePlayCounts) {
    const r = row as UserGamePlayCountsRow;
    const key = playCountKey(r.userId, r.gameSlug);
    const existing = tables.userGamePlayCounts.get(key);
    if (existing) {
      const updated = { ...existing };
      for (const [col, val] of Object.entries(set)) {
        if (isSqlExpression(val) && col === "playCount") {
          updated.playCount = existing.playCount + 1;
        } else {
          (updated as Record<string, unknown>)[col] = val;
        }
      }
      tables.userGamePlayCounts.set(key, updated);
    } else {
      tables.userGamePlayCounts.set(key, r);
    }
  }
}

vi.mock("@db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        const allRows = () => Promise.resolve(getTableRows(table));

        return {
          where: vi.fn((filter: unknown) => {
            const filteredRows = () =>
              Promise.resolve(filterRowsByEq(table, filter));

            return {
              limit: vi.fn(filteredRows),
              then(
                onFulfilled?: (value: unknown) => unknown,
                onRejected?: (reason: unknown) => unknown,
              ) {
                return filteredRows().then(onFulfilled, onRejected);
              },
            };
          }),
          then(
            onFulfilled?: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            return allRows().then(onFulfilled, onRejected);
          },
        };
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((rowOrRows: unknown) => {
        const performInsert = async () => {
          insertRows(table, rowOrRows);
        };

        return {
          onConflictDoUpdate: vi.fn(
            async ({ set }: { set: Record<string, unknown> }) => {
              const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
              for (const row of rows) {
                upsertRow(table, row, set);
              }
            },
          ),
          then(
            onFulfilled?: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            return performInsert().then(onFulfilled, onRejected);
          },
        };
      }),
    })),
  },
  userPreferences,
  gameCatalog,
  userGamePlayCounts,
}));
