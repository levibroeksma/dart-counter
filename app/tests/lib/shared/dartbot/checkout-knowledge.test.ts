import { describe, it, expect } from "vitest";
import { createCheckoutKnowledge } from "@lib/shared/dartbot/checkout/CheckoutKnowledge";

describe("checkout knowledge", () => {
  const knowledge = createCheckoutKnowledge();

  it("returns curated multi-route for 81", () => {
    const routes = knowledge.routes(81);
    expect(routes.length).toBeGreaterThanOrEqual(2);
    expect(routes[0]!.darts.map((d) => d.label)).toEqual(["T19", "D12"]);
  });

  it("falls back to generated route for uncovered finish", () => {
    const routes = knowledge.routes(32);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.quality).toBe(70);
    expect(routes[0]!.darts.map((d) => d.label)).toEqual(["D16"]);
  });
});
