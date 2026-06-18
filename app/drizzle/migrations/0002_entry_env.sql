ALTER TABLE "user_preferences" ADD COLUMN "entry_env" varchar(8) DEFAULT 'prod' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_pkey";--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_entry_env_pk" PRIMARY KEY("user_id","entry_env");--> statement-breakpoint
ALTER TABLE "game_catalog" ADD COLUMN "entry_env" varchar(8) DEFAULT 'prod' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_game_play_counts" ADD COLUMN "entry_env" varchar(8) DEFAULT 'prod' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_game_play_counts" DROP CONSTRAINT "user_game_play_counts_user_id_game_slug_pk";--> statement-breakpoint
ALTER TABLE "user_game_play_counts" ADD CONSTRAINT "user_game_play_counts_user_id_game_slug_entry_env_pk" PRIMARY KEY("user_id","game_slug","entry_env");--> statement-breakpoint
ALTER TABLE "player_dart_stats" ADD COLUMN "entry_env" varchar(8) DEFAULT 'prod' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_dart_stats" DROP CONSTRAINT "player_dart_stats_pkey";--> statement-breakpoint
ALTER TABLE "player_dart_stats" ADD CONSTRAINT "player_dart_stats_user_id_entry_env_pk" PRIMARY KEY("user_id","entry_env");--> statement-breakpoint
ALTER TABLE "player_score_training_stats" ADD COLUMN "entry_env" varchar(8) DEFAULT 'prod' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_score_training_stats" DROP CONSTRAINT "player_score_training_stats_pkey";--> statement-breakpoint
ALTER TABLE "player_score_training_stats" ADD CONSTRAINT "player_score_training_stats_user_id_entry_env_pk" PRIMARY KEY("user_id","entry_env");--> statement-breakpoint
ALTER TABLE "player_singles_training_stats" ADD COLUMN "entry_env" varchar(8) DEFAULT 'prod' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_singles_training_stats" DROP CONSTRAINT "player_singles_training_stats_pkey";--> statement-breakpoint
ALTER TABLE "player_singles_training_stats" ADD CONSTRAINT "player_singles_training_stats_user_id_entry_env_pk" PRIMARY KEY("user_id","entry_env");--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "entry_env" varchar(8) DEFAULT 'prod' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_sessions" DROP CONSTRAINT "game_sessions_user_id_game_slug_pk";--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_game_slug_entry_env_pk" PRIMARY KEY("user_id","game_slug","entry_env");
