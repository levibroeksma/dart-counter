export type FiveOhOneUserOrGuestPlayer = {
  id: string;
  type: "user" | "guest";
  name: string;
};

export type FiveOhOneDartbotPlayer = {
  id: string;
  type: "dartbot";
  name: "DartBot";
  level: number;
};

export type FiveOhOnePlayer =
  | FiveOhOneUserOrGuestPlayer
  | FiveOhOneDartbotPlayer;

export type FiveOhOneMatchMode = "best-of" | "first-to";
export type FiveOhOneUnit = "legs" | "sets";

export type FiveOhOneSettings = {
  matchMode: FiveOhOneMatchMode;
  targetCount: number;
  unit: FiveOhOneUnit;
  players: FiveOhOnePlayer[];
};
