export type GameType = {
  slug: string;
  displayName: string;
  sortOrder: number;
  enabled: boolean;
};

export type GameConfig = {
  slug: string;
  settings: Record<string, unknown>;
  updatedAt: string;
};

export type UserGameStats = {
  playCounts: Record<string, number>;
};

export const SEED_GAMES: GameType[] = [
  { slug: "501", displayName: "501", sortOrder: 1, enabled: true },
  {
    slug: "ten-up-one-down",
    displayName: "Ten Up One Down",
    sortOrder: 2,
    enabled: true,
  },
  { slug: "121", displayName: "121", sortOrder: 3, enabled: true },
];
