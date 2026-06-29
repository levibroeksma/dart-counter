CREATE TABLE IF NOT EXISTS "player_501_stats" (
  "user_id" uuid NOT NULL,
  "entry_env" varchar(8) DEFAULT 'prod' NOT NULL,
  "games_completed" integer DEFAULT 0 NOT NULL,
  "games_won" integer DEFAULT 0 NOT NULL,
  "total_darts_thrown" integer DEFAULT 0 NOT NULL,
  "total_checkouts" integer DEFAULT 0 NOT NULL,
  "best_leg_average" real DEFAULT 0 NOT NULL,
  "best_match_average" real DEFAULT 0 NOT NULL,
  CONSTRAINT "player_501_stats_user_id_entry_env_pk" PRIMARY KEY("user_id","entry_env")
);--> statement-breakpoint
UPDATE "game_catalog" SET "released" = true WHERE "slug" = '501';
