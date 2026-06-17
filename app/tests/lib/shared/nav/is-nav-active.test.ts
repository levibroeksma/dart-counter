import { describe, it, expect } from "vitest";
import { isNavActive } from "@lib/shared/nav/is-nav-active";

describe("isNavActive", () => {
  it("matches home exactly", () => {
    expect(isNavActive("/", "/", undefined)).toBe(true);
    expect(isNavActive("/games", "/", undefined)).toBe(false);
  });

  it("matches games list and nested routes via prefix", () => {
    expect(isNavActive("/games", "/games", "/games")).toBe(true);
    expect(isNavActive("/games/score-training", "/games", "/games")).toBe(true);
    expect(
      isNavActive("/games/settings-ten-up-one-down", "/games", "/games")
    ).toBe(true);
  });

  it("does not match home for games paths", () => {
    expect(isNavActive("/games", "/", undefined)).toBe(false);
  });

  it("matches statistics exactly", () => {
    expect(isNavActive("/statistics", "/statistics", undefined)).toBe(true);
    expect(isNavActive("/statistics/foo", "/statistics", undefined)).toBe(false);
  });
});
