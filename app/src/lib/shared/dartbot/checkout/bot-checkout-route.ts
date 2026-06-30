import type { Segment } from "@lib/shared/dartbot/types";

export type BotCheckoutRoute = {
  finish: number;
  darts: Segment[];
  quality: number;
  preferredLeave?: number;
};
