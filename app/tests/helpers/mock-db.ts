import { vi } from "vitest";
import { userPreferences } from "@db/schema";

type UserPreferencesRow = typeof userPreferences.$inferSelect;

const tables = {
  userPreferences: new Map<string, UserPreferencesRow>(),
};

export const mockDb = {
  tables,
  reset() {
    tables.userPreferences.clear();
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

vi.mock("@db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn((filter: unknown) => ({
          limit: vi.fn(async () => {
            if (table !== userPreferences) return [];

            const userId = extractEqUserId(filter);
            if (userId) {
              const row = tables.userPreferences.get(userId);
              return row ? [row] : [];
            }
            return [...tables.userPreferences.values()];
          }),
        })),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((row: UserPreferencesRow) => ({
        onConflictDoUpdate: vi.fn(
          async ({ set }: { set: Partial<UserPreferencesRow> }) => {
            if (table !== userPreferences) return;
            tables.userPreferences.set(row.userId, {
              ...row,
              ...set,
            } as UserPreferencesRow);
          },
        ),
      })),
    })),
  },
  userPreferences,
}));
