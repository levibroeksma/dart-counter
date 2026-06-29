CREATE TABLE IF NOT EXISTS player_501_stats (
  user_id uuid NOT NULL,
  entry_env varchar(16) NOT NULL DEFAULT 'prod',
  games_completed integer NOT NULL DEFAULT 0,
  games_won integer NOT NULL DEFAULT 0,
  total_darts_thrown integer NOT NULL DEFAULT 0,
  total_checkouts integer NOT NULL DEFAULT 0,
  best_leg_average real NOT NULL DEFAULT 0,
  best_match_average real NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, entry_env)
);

UPDATE game_catalog SET released = true WHERE slug = '501';
