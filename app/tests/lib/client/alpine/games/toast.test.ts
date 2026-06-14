// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gameToast } from "@lib/client/alpine/games/toast";

describe("gameToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    history.replaceState({}, "", "/games?error=unknown-game");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows message from error param and cleans URL on dismiss", () => {
    const toast = gameToast();
    toast.init();

    expect(toast.visible).toBe(true);
    expect(toast.message).toBe("That game does not exist.");

    vi.advanceTimersByTime(4000);
    expect(toast.visible).toBe(false);
    expect(window.location.pathname).toBe("/games");
    expect(window.location.search).toBe("");
  });

  it("stays hidden when no error param", () => {
    history.replaceState({}, "", "/games");
    const toast = gameToast();
    toast.init();
    expect(toast.visible).toBe(false);
  });
});
