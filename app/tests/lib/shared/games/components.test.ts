import { describe, it, expect } from "vitest";
import {
  getSettingsFormComponent,
  getPlayComponent,
  hasGameComponents,
} from "@lib/shared/games/components";

describe("game component registry", () => {
  it("resolves known slugs", () => {
    expect(hasGameComponents("501")).toBe(true);
    expect(getSettingsFormComponent("501")).toBeDefined();
    expect(getPlayComponent("501")).toBeDefined();
  });

  it("resolves score-training slug", () => {
    expect(hasGameComponents("score-training")).toBe(true);
    expect(getSettingsFormComponent("score-training")).toBeDefined();
    expect(getPlayComponent("score-training")).toBeDefined();
  });

  it("returns undefined for unknown slugs", () => {
    expect(hasGameComponents("invalid")).toBe(false);
    expect(getSettingsFormComponent("invalid")).toBeUndefined();
    expect(getPlayComponent("invalid")).toBeUndefined();
  });
});
