export type ScoreTrainingSettings =
  | { endMode: "rounds"; roundCount: number }
  | { endMode: "timed"; playtimeSeconds: number };
