import { vi } from "vitest";
import { userPreferences, gameCatalog } from "@db/schema";

type UserPreferencesRow = typeof userPreferences.$inferSelect;
type GameCatalogRow = typeof gameCatalog.$inferSelect;

const tables = {
  userPreferences: new Map<string, UserPreferencesRow>(),
  gameCatalog: new Map<string, GameCatalogRow>(),
};

export const mockDb = {
  tables,
  reset() {
    tables.userPreferences.clear();
    tables.gameCatalog.clear();
  },
};

function extractEqUserId(filter: unknown): string | undefined {
  const visit = (node: unknown): string | undefined => {
    if (typeof node === "string" && /^[0-9a-f-]{36}$/i.test(node)) {
      return node;
    }
    if (!node || typeof node !== "object") return undefined;

    if ("value" in node) {
      const value = (node as { value: unknown }).value;
      if (typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)) {
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

function getTableRows(table: unknown): unknown[] {
  if (table === userPreferences) return [...tables.userPreferences.values()];
  if (table === gameCatalog) return [...tables.gameCatalog.values()];
  return [];
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
  }
}

vi.mock("@db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        const allRows = () => Promise.resolve(getTableRows(table));

        return {
          where: vi.fn((filter: unknown) => ({
            limit: vi.fn(async () => {
              if (table === userPreferences) {
                const userId = extractEqUserId(filter);
                if (userId) {
                  const row = tables.userPreferences.get(userId);
                  return row ? [row] : [];
                }
              }
              return getTableRows(table);
            }),
          })),
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
}));
