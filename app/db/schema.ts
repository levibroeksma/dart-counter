import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { ENTRY_ENV } from "@lib/shared/constants/entry-env";

const entryEnvColumn = () =>
  varchar("entry_env", { length: 8 }).notNull().default(ENTRY_ENV.PROD);

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: uuid("user_id").notNull(),
    entryEnv: entryEnvColumn(),
    displayName: varchar("display_name", { length: 20 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.entryEnv] })],
);

export const gameCatalog = pgTable("game_catalog", {
  slug: varchar("slug", { length: 64 }).primaryKey(),
  entryEnv: entryEnvColumn(),
  displayName: varchar("display_name", { length: 128 }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  enabled: boolean("enabled").notNull(),
  released: boolean("released").notNull(),
});

export const userGamePlayCounts = pgTable(
  "user_game_play_counts",
  {
    userId: uuid("user_id").notNull(),
    gameSlug: varchar("game_slug", { length: 64 }).notNull(),
    entryEnv: entryEnvColumn(),
    playCount: integer("play_count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.gameSlug, table.entryEnv] }),
  ],
);

export const playerDartStats = pgTable(
  "player_dart_stats",
  {
    userId: uuid("user_id").notNull(),
    entryEnv: entryEnvColumn(),
    doubleAttempts: integer("double_attempts").notNull().default(0),
    doubleHits: integer("double_hits").notNull().default(0),
    totalCheckouts: integer("total_checkouts").notNull().default(0),
    totalCheckoutDarts: integer("total_checkout_darts").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.entryEnv] })],
);

export const playerScoreTrainingStats = pgTable(
  "player_score_training_stats",
  {
    userId: uuid("user_id").notNull(),
    entryEnv: entryEnvColumn(),
    gamesCompleted: integer("games_completed").notNull().default(0),
    totalDartsThrown: integer("total_darts_thrown").notNull().default(0),
    totalPointsScored: integer("total_points_scored").notNull().default(0),
    bestVisitScore: integer("best_visit_score").notNull().default(0),
    bestGameAverage: real("best_game_average").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.entryEnv] })],
);

export const player501Stats = pgTable(
  "player_501_stats",
  {
    userId: uuid("user_id").notNull(),
    entryEnv: entryEnvColumn(),
    gamesCompleted: integer("games_completed").notNull().default(0),
    gamesWon: integer("games_won").notNull().default(0),
    totalDartsThrown: integer("total_darts_thrown").notNull().default(0),
    totalCheckouts: integer("total_checkouts").notNull().default(0),
    bestLegAverage: real("best_leg_average").notNull().default(0),
    bestMatchAverage: real("best_match_average").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.entryEnv] })],
);

export const playerSinglesTrainingStats = pgTable(
  "player_singles_training_stats",
  {
    userId: uuid("user_id").notNull(),
    entryEnv: entryEnvColumn(),
    gamesCompleted: integer("games_completed").notNull().default(0),
    gamesFailed: integer("games_failed").notNull().default(0),
    totalDartsThrown: integer("total_darts_thrown").notNull().default(0),
    totalHits: integer("total_hits").notNull().default(0),
    totalScore: integer("total_score").notNull().default(0),
    dartPositionHits: integer("dart_position_hits").array().notNull().default([0, 0, 0]),
    dartPositionAttempts: integer("dart_position_attempts")
      .array()
      .notNull()
      .default([0, 0, 0]),
    bestHitRatio: real("best_hit_ratio").notNull().default(0),
    bestScore: integer("best_score").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.entryEnv] })],
);

export const gameSessions = pgTable(
  "game_sessions",
  {
    userId: uuid("user_id").notNull(),
    gameSlug: varchar("game_slug", { length: 64 }).notNull(),
    entryEnv: entryEnvColumn(),
    sessionData: jsonb("session_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.gameSlug, table.entryEnv] }),
  ],
);
