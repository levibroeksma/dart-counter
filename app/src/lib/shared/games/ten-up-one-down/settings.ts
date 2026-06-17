export type TenUpOneDownSettings =
  | { endMode: "rounds"; roundCount: number }
  | { endMode: "timed"; playtimeSeconds: number };
