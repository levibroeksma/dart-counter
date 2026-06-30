import { vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ENTRY_ENV } from "@lib/shared/constants/entry-env";
import {
  userPreferences,
  gameCatalog,
  gameSessions,
  userGamePlayCounts,
  playerDartStats,
  player501Stats,
  playerScoreTrainingStats,
  playerSinglesTrainingStats,
  playerStatCompletions,
} from "@db/schema";

type UserPreferencesRow = typeof userPreferences.$inferSelect;
type GameCatalogRow = typeof gameCatalog.$inferSelect;
type GameSessionsRow = typeof gameSessions.$inferSelect;
type UserGamePlayCountsRow = typeof userGamePlayCounts.$inferSelect;
type PlayerDartStatsRow = typeof playerDartStats.$inferSelect;
type Player501StatsRow = typeof player501Stats.$inferSelect;
type PlayerScoreTrainingStatsRow = typeof playerScoreTrainingStats.$inferSelect;
type PlayerSinglesTrainingStatsRow = typeof playerSinglesTrainingStats.$inferSelect;
type PlayerStatCompletionsRow = typeof playerStatCompletions.$inferSelect;

const tables = {
  userPreferences: new Map<string, UserPreferencesRow>(),
  gameCatalog: new Map<string, GameCatalogRow>(),
  gameSessions: new Map<string, GameSessionsRow>(),
  userGamePlayCounts: new Map<string, UserGamePlayCountsRow>(),
  playerDartStats: new Map<string, PlayerDartStatsRow>(),
  player501Stats: new Map<string, Player501StatsRow>(),
  playerScoreTrainingStats: new Map<string, PlayerScoreTrainingStatsRow>(),
  playerSinglesTrainingStats: new Map<string, PlayerSinglesTrainingStatsRow>(),
  playerStatCompletions: new Map<string, PlayerStatCompletionsRow[]>(),
};

export const TEST_ENTRY_ENV = ENTRY_ENV.DEV;

export function userScopedKey(userId: string): string {
  return scopedKey(userId, TEST_ENTRY_ENV);
}

export function sessionScopedKey(userId: string, gameSlug: string): string {
  return scopedKey(userId, gameSlug, TEST_ENTRY_ENV);
}

export function playCountScopedKey(userId: string, gameSlug: string): string {
  return scopedKey(userId, gameSlug, TEST_ENTRY_ENV);
}

export const mockDb = {
  tables,
  reset() {
    tables.userPreferences.clear();
    tables.gameCatalog.clear();
    tables.gameSessions.clear();
    tables.userGamePlayCounts.clear();
    tables.playerDartStats.clear();
    tables.player501Stats.clear();
    tables.playerScoreTrainingStats.clear();
    tables.playerSinglesTrainingStats.clear();
    tables.playerStatCompletions.clear();
  },
};

function scopedKey(...parts: string[]): string {
  return parts.join(":");
}

function extractEqValues(filter: unknown): string[] {
  const values: string[] = [];

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;

    if ("value" in node) {
      const value = (node as { value: unknown }).value;
      if (typeof value === "string") {
        values.push(value);
      }
    }

    if ("queryChunks" in node) {
      for (const chunk of (node as { queryChunks: unknown[] }).queryChunks) {
        visit(chunk);
      }
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
    }
  };

  visit(filter);
  return values;
}

function isSqlExpression(val: unknown): boolean {
  return val !== null && typeof val === "object" && "queryChunks" in val;
}

function getTableRows(table: unknown): unknown[] {
  if (table === userPreferences) return [...tables.userPreferences.values()];
  if (table === gameCatalog) return [...tables.gameCatalog.values()];
  if (table === gameSessions) return [...tables.gameSessions.values()];
  if (table === userGamePlayCounts) return [...tables.userGamePlayCounts.values()];
  if (table === playerDartStats) return [...tables.playerDartStats.values()];
  if (table === player501Stats) return [...tables.player501Stats.values()];
  if (table === playerScoreTrainingStats) {
    return [...tables.playerScoreTrainingStats.values()];
  }
  if (table === playerSinglesTrainingStats) {
    return [...tables.playerSinglesTrainingStats.values()];
  }
  if (table === playerStatCompletions) {
    return [...tables.playerStatCompletions.values()].flat();
  }
  return [];
}

function filterRowsByEq(table: unknown, filter: unknown): unknown[] {
  const eqValues = extractEqValues(filter);
  if (eqValues.length === 0) return getTableRows(table);

  if (table === userPreferences) {
    const [entryEnv, userId] = eqValues;
    if (!entryEnv || !userId) return getTableRows(table);
    const row = tables.userPreferences.get(scopedKey(userId, entryEnv));
    return row ? [row] : [];
  }

  if (table === gameCatalog) {
    const [entryEnv] = eqValues;
    if (!entryEnv) return getTableRows(table);
    return [...tables.gameCatalog.values()].filter((row) => row.entryEnv === entryEnv);
  }

  if (table === userGamePlayCounts) {
    const [entryEnv, userId] = eqValues;
    if (!entryEnv || !userId) return getTableRows(table);
    return [...tables.userGamePlayCounts.values()].filter(
      (row) => row.entryEnv === entryEnv && row.userId === userId,
    );
  }

  if (table === gameSessions) {
    const [entryEnv, userId, gameSlug] = eqValues;
    if (!entryEnv || !userId || !gameSlug) return [...tables.gameSessions.values()];
    const row = tables.gameSessions.get(scopedKey(userId, gameSlug, entryEnv));
    return row ? [row] : [];
  }

  if (table === playerDartStats) {
    const [entryEnv, userId] = eqValues;
    if (!entryEnv || !userId) return getTableRows(table);
    const row = tables.playerDartStats.get(scopedKey(userId, entryEnv));
    return row ? [row] : [];
  }

  if (table === player501Stats) {
    const [entryEnv, userId] = eqValues;
    if (!entryEnv || !userId) return getTableRows(table);
    const row = tables.player501Stats.get(scopedKey(userId, entryEnv));
    return row ? [row] : [];
  }

  if (table === playerScoreTrainingStats) {
    const [entryEnv, userId] = eqValues;
    if (!entryEnv || !userId) return getTableRows(table);
    const row = tables.playerScoreTrainingStats.get(scopedKey(userId, entryEnv));
    return row ? [row] : [];
  }

  if (table === playerSinglesTrainingStats) {
    const [entryEnv, userId] = eqValues;
    if (!entryEnv || !userId) return getTableRows(table);
    const row = tables.playerSinglesTrainingStats.get(scopedKey(userId, entryEnv));
    return row ? [row] : [];
  }

  if (table === playerStatCompletions) {
    const [entryEnv, userId] = eqValues;
    if (!entryEnv || !userId) return getTableRows(table);
    return [...(tables.playerStatCompletions.get(scopedKey(userId, entryEnv)) ?? [])];
  }

  return getTableRows(table);
}

function insertRows(table: unknown, rows: unknown | unknown[]): void {
  const list = Array.isArray(rows) ? rows : [rows];
  if (table === userPreferences) {
    for (const row of list as UserPreferencesRow[]) {
      tables.userPreferences.set(
        scopedKey(row.userId, row.entryEnv ?? ENTRY_ENV.DEV),
        row,
      );
    }
  } else if (table === gameCatalog) {
    for (const row of list as GameCatalogRow[]) {
      tables.gameCatalog.set(row.slug, row);
    }
  } else if (table === gameSessions) {
    for (const row of list as GameSessionsRow[]) {
      tables.gameSessions.set(
        scopedKey(row.userId, row.gameSlug, row.entryEnv ?? ENTRY_ENV.DEV),
        row,
      );
    }
  } else if (table === userGamePlayCounts) {
    for (const row of list as UserGamePlayCountsRow[]) {
      tables.userGamePlayCounts.set(
        scopedKey(row.userId, row.gameSlug, row.entryEnv ?? ENTRY_ENV.DEV),
        row,
      );
    }
  } else if (table === playerDartStats) {
    for (const row of list as PlayerDartStatsRow[]) {
      tables.playerDartStats.set(
        scopedKey(row.userId, row.entryEnv ?? ENTRY_ENV.DEV),
        row,
      );
    }
  } else if (table === player501Stats) {
    for (const row of list as Player501StatsRow[]) {
      tables.player501Stats.set(
        scopedKey(row.userId, row.entryEnv ?? ENTRY_ENV.DEV),
        row,
      );
    }
  } else if (table === playerScoreTrainingStats) {
    for (const row of list as PlayerScoreTrainingStatsRow[]) {
      tables.playerScoreTrainingStats.set(
        scopedKey(row.userId, row.entryEnv ?? ENTRY_ENV.DEV),
        row,
      );
    }
  } else if (table === playerSinglesTrainingStats) {
    for (const row of list as PlayerSinglesTrainingStatsRow[]) {
      tables.playerSinglesTrainingStats.set(
        scopedKey(row.userId, row.entryEnv ?? ENTRY_ENV.DEV),
        row,
      );
    }
  } else if (table === playerStatCompletions) {
    for (const row of list as Partial<PlayerStatCompletionsRow>[]) {
      const entryEnv = row.entryEnv ?? ENTRY_ENV.DEV;
      const userId = row.userId;
      if (!userId) continue;
      const key = scopedKey(userId, entryEnv);
      const existingRows = tables.playerStatCompletions.get(key) ?? [];
      existingRows.push({
        id: row.id ?? randomUUID(),
        userId,
        entryEnv,
        gameSlug: row.gameSlug ?? "",
        completedAt: row.completedAt ?? new Date(),
        pointsScored: row.pointsScored ?? 0,
        dartsThrown: row.dartsThrown ?? 0,
        scoringPoints: row.scoringPoints ?? 0,
        scoringVisits: row.scoringVisits ?? 0,
        doubleAttempts: row.doubleAttempts ?? 0,
        doubleHits: row.doubleHits ?? 0,
        visits100Plus: row.visits100Plus ?? 0,
        visits120Plus: row.visits120Plus ?? 0,
        visits140Plus: row.visits140Plus ?? 0,
        visits180: row.visits180 ?? 0,
        segmentHits: row.segmentHits ?? 0,
        segmentAttempts: row.segmentAttempts ?? 0,
      });
      tables.playerStatCompletions.set(key, existingRows);
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
    const entryEnv = r.entryEnv ?? ENTRY_ENV.DEV;
    tables.userPreferences.set(scopedKey(r.userId, entryEnv), {
      ...r,
      entryEnv,
      ...set,
    } as UserPreferencesRow);
  } else if (table === gameCatalog) {
    const r = row as GameCatalogRow;
    tables.gameCatalog.set(r.slug, { ...r, ...set } as GameCatalogRow);
  } else if (table === gameSessions) {
    const r = row as GameSessionsRow;
    const entryEnv = r.entryEnv ?? ENTRY_ENV.DEV;
    const key = scopedKey(r.userId, r.gameSlug, entryEnv);
    const existing = tables.gameSessions.get(key);
    tables.gameSessions.set(key, {
      ...(existing ?? r),
      ...set,
      userId: r.userId,
      gameSlug: r.gameSlug,
      entryEnv,
    } as GameSessionsRow);
  } else if (table === userGamePlayCounts) {
    const r = row as UserGamePlayCountsRow;
    const entryEnv = r.entryEnv ?? ENTRY_ENV.DEV;
    const key = scopedKey(r.userId, r.gameSlug, entryEnv);
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
  } else if (table === playerDartStats) {
    const r = row as PlayerDartStatsRow;
    const entryEnv = r.entryEnv ?? ENTRY_ENV.DEV;
    const existing = tables.playerDartStats.get(scopedKey(r.userId, entryEnv));
    tables.playerDartStats.set(scopedKey(r.userId, entryEnv), {
      ...(existing ?? r),
      ...set,
      userId: r.userId,
      entryEnv,
    } as PlayerDartStatsRow);
  } else if (table === player501Stats) {
    const r = row as Player501StatsRow;
    const entryEnv = r.entryEnv ?? ENTRY_ENV.DEV;
    const existing = tables.player501Stats.get(scopedKey(r.userId, entryEnv));
    tables.player501Stats.set(scopedKey(r.userId, entryEnv), {
      ...(existing ?? r),
      ...set,
      userId: r.userId,
      entryEnv,
    } as Player501StatsRow);
  } else if (table === playerScoreTrainingStats) {
    const r = row as PlayerScoreTrainingStatsRow;
    const entryEnv = r.entryEnv ?? ENTRY_ENV.DEV;
    const existing = tables.playerScoreTrainingStats.get(scopedKey(r.userId, entryEnv));
    tables.playerScoreTrainingStats.set(scopedKey(r.userId, entryEnv), {
      ...(existing ?? r),
      ...set,
      userId: r.userId,
      entryEnv,
    } as PlayerScoreTrainingStatsRow);
  } else if (table === playerSinglesTrainingStats) {
    const r = row as PlayerSinglesTrainingStatsRow;
    const entryEnv = r.entryEnv ?? ENTRY_ENV.DEV;
    const existing = tables.playerSinglesTrainingStats.get(scopedKey(r.userId, entryEnv));
    tables.playerSinglesTrainingStats.set(scopedKey(r.userId, entryEnv), {
      ...(existing ?? r),
      ...set,
      userId: r.userId,
      entryEnv,
    } as PlayerSinglesTrainingStatsRow);
  }
}

function deleteRows(table: unknown, filter: unknown): void {
  if (table === gameSessions) {
    const [entryEnv, userId, gameSlug] = extractEqValues(filter);
    if (!entryEnv || !userId || !gameSlug) return;
    tables.gameSessions.delete(scopedKey(userId, gameSlug, entryEnv));
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
              orderBy: vi.fn(() => {
                const sortedRows = async () => {
                  const rows = filterRowsByEq(table, filter);
                  if (table === playerStatCompletions) {
                    return [...(rows as PlayerStatCompletionsRow[])].sort(
                      (a, b) =>
                        a.completedAt.getTime() - b.completedAt.getTime(),
                    );
                  }
                  return rows;
                };
                return {
                  then(
                    onFulfilled?: (value: unknown) => unknown,
                    onRejected?: (reason: unknown) => unknown,
                  ) {
                    return sortedRows().then(onFulfilled, onRejected);
                  },
                };
              }),
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
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(async (filter: unknown) => {
        deleteRows(table, filter);
      }),
    })),
  },
  userPreferences,
  gameCatalog,
  gameSessions,
  userGamePlayCounts,
  playerDartStats,
  player501Stats,
  playerScoreTrainingStats,
  playerSinglesTrainingStats,
  playerStatCompletions,
}));
