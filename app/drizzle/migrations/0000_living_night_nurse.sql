CREATE TABLE "game_catalog" (
	"slug" varchar(64) PRIMARY KEY NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"sort_order" integer NOT NULL,
	"enabled" boolean NOT NULL,
	"released" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"user_id" uuid NOT NULL,
	"game_slug" varchar(64) NOT NULL,
	"session_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_sessions_user_id_game_slug_pk" PRIMARY KEY("user_id","game_slug")
);
--> statement-breakpoint
CREATE TABLE "player_dart_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"double_attempts" integer DEFAULT 0 NOT NULL,
	"double_hits" integer DEFAULT 0 NOT NULL,
	"total_checkouts" integer DEFAULT 0 NOT NULL,
	"total_checkout_darts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_score_training_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"games_completed" integer DEFAULT 0 NOT NULL,
	"total_darts_thrown" integer DEFAULT 0 NOT NULL,
	"total_points_scored" integer DEFAULT 0 NOT NULL,
	"best_visit_score" integer DEFAULT 0 NOT NULL,
	"best_game_average" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_singles_training_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"games_completed" integer DEFAULT 0 NOT NULL,
	"games_failed" integer DEFAULT 0 NOT NULL,
	"total_darts_thrown" integer DEFAULT 0 NOT NULL,
	"total_hits" integer DEFAULT 0 NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"dart_position_hits" integer[] DEFAULT '{0,0,0}' NOT NULL,
	"dart_position_attempts" integer[] DEFAULT '{0,0,0}' NOT NULL,
	"best_hit_ratio" real DEFAULT 0 NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_game_play_counts" (
	"user_id" uuid NOT NULL,
	"game_slug" varchar(64) NOT NULL,
	"play_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_game_play_counts_user_id_game_slug_pk" PRIMARY KEY("user_id","game_slug")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(20),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
