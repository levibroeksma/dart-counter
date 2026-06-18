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

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey(),
  displayName: varchar("display_name", { length: 20 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const gameCatalog = pgTable("game_catalog", {
  slug: varchar("slug", { length: 64 }).primaryKey(),
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
    playCount: integer("play_count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.gameSlug] })],
);

export const playerDartStats = pgTable("player_dart_stats", {
  userId: uuid("user_id").primaryKey(),
  doubleAttempts: integer("double_attempts").notNull().default(0),
  doubleHits: integer("double_hits").notNull().default(0),
  totalCheckouts: integer("total_checkouts").notNull().default(0),
  totalCheckoutDarts: integer("total_checkout_darts").notNull().default(0),
});

export const playerScoreTrainingStats = pgTable("player_score_training_stats", {
  userId: uuid("user_id").primaryKey(),
  gamesCompleted: integer("games_completed").notNull().default(0),
  totalDartsThrown: integer("total_darts_thrown").notNull().default(0),
  totalPointsScored: integer("total_points_scored").notNull().default(0),
  bestVisitScore: integer("best_visit_score").notNull().default(0),
  bestGameAverage: real("best_game_average").notNull().default(0),
});

export const playerSinglesTrainingStats = pgTable("player_singles_training_stats", {
  userId: uuid("user_id").primaryKey(),
  gamesCompleted: integer("games_completed").notNull().default(0),
  gamesFailed: integer("games_failed").notNull().default(0),
  totalDartsThrown: integer("total_darts_thrown").notNull().default(0),
  totalHits: integer("total_hits").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  dartPositionHits: integer("dart_position_hits").array().notNull().default([0, 0, 0]),
  dartPositionAttempts: integer("dart_position_attempts").array().notNull().default([0, 0, 0]),
  bestHitRatio: real("best_hit_ratio").notNull().default(0),
  bestScore: integer("best_score").notNull().default(0),
});

export const gameSessions = pgTable(
  "game_sessions",
  {
    userId: uuid("user_id").notNull(),
    gameSlug: varchar("game_slug", { length: 64 }).notNull(),
    sessionData: jsonb("session_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.gameSlug] })],
);
