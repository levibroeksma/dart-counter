import type { Segment } from "../types";

export type BotCheckoutRoute = {
  finish: number;
  darts: Segment[];
  quality: number;
  preferredLeave?: number;
};
