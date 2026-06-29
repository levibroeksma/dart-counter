export type FiveOhOnePlayer = {
  id: string;
  type: "user" | "guest";
  name: string;
};

export type FiveOhOneMatchMode = "best-of" | "first-to";
export type FiveOhOneUnit = "legs" | "sets";

export type FiveOhOneSettings = {
  matchMode: FiveOhOneMatchMode;
  targetCount: number;
  unit: FiveOhOneUnit;
  players: FiveOhOnePlayer[];
};
