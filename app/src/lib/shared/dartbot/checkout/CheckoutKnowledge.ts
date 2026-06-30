import routesJson from "./checkout-routes.json";
import { parseSegment } from "../segments";
import type { BotCheckoutRoute } from "./bot-checkout-route";
import { generatedRoutes } from "./GeneratedCheckoutKnowledge";

export interface CheckoutKnowledge {
  routes(remaining: number): BotCheckoutRoute[];
}

function loadCurated(): Map<number, BotCheckoutRoute[]> {
  const map = new Map<number, BotCheckoutRoute[]>();
  for (const [key, entries] of Object.entries(
    routesJson as Record<string, { darts: string[]; quality: number }[]>,
  )) {
    const finish = Number(key);
    map.set(
      finish,
      entries.map((e) => ({
        finish,
        darts: e.darts.map((label) => parseSegment(label)),
        quality: e.quality,
      })),
    );
  }
  return map;
}

export function createCheckoutKnowledge(): CheckoutKnowledge {
  const curated = loadCurated();
  return {
    routes(remaining: number) {
      const fromJson = curated.get(remaining);
      if (fromJson && fromJson.length > 0) return fromJson;
      return generatedRoutes(remaining);
    },
  };
}
