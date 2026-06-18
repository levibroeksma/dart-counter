INSERT INTO game_catalog (slug, display_name, sort_order, enabled, released) VALUES
  ('501', '501', 1, true, false),
  ('ten-up-one-down', 'Ten Up One Down', 2, true, true),
  ('121', '121', 3, true, false),
  ('score-training', 'Score Training', 4, true, true),
  ('singles-training', 'Singles Training', 5, true, true)
ON CONFLICT (slug) DO NOTHING;
