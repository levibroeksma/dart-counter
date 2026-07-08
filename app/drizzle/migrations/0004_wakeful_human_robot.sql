CREATE TABLE "player_stat_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_env" varchar(8) DEFAULT 'prod' NOT NULL,
	"game_slug" varchar(64) NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"points_scored" integer DEFAULT 0 NOT NULL,
	"darts_thrown" integer DEFAULT 0 NOT NULL,
	"scoring_points" integer DEFAULT 0 NOT NULL,
	"scoring_visits" integer DEFAULT 0 NOT NULL,
	"double_attempts" integer DEFAULT 0 NOT NULL,
	"double_hits" integer DEFAULT 0 NOT NULL,
	"visits_100_plus" smallint DEFAULT 0 NOT NULL,
	"visits_120_plus" smallint DEFAULT 0 NOT NULL,
	"visits_140_plus" smallint DEFAULT 0 NOT NULL,
	"visits_180" smallint DEFAULT 0 NOT NULL,
	"segment_hits" integer DEFAULT 0 NOT NULL,
	"segment_attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "player_stat_completions_user_completed_idx" ON "player_stat_completions" USING btree ("user_id","entry_env","completed_at");
