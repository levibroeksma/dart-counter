// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { fiveOhOneSettings } from "@lib/client/alpine/games/501.settings";

describe("fiveOhOneSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to one user player and no opponent", () => {
    const component = fiveOhOneSettings("Levi", "user-1");

    expect(component.matchMode).toBe("best-of");
    expect(component.unit).toBe("legs");
    expect(component.players).toHaveLength(1);
    expect(component.players[0]).toEqual({
      id: "user-1",
      type: "user",
      name: "Levi",
    });
    expect(component.hasOpponent).toBe(false);
  });

  it("adds a guest via confirmGuest", () => {
    const component = fiveOhOneSettings("Levi", "user-1");

    component.guestNameDraft = "Bob";
    component.confirmGuest();

    expect(component.hasOpponent).toBe(true);
    expect(component.players).toHaveLength(2);
    expect(component.players[1]?.name).toBe("Bob");
    expect(component.players[1]?.type).toBe("guest");
  });

  it("adds a guest on insecure HTTP contexts", () => {
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("crypto", { randomUUID: vi.fn() });

    const component = fiveOhOneSettings("Levi", "user-1");
    component.guestNameDraft = "Bob";
    component.confirmGuest();

    expect(component.hasOpponent).toBe(true);
    expect(component.players[1]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("removes guest player", () => {
    const component = fiveOhOneSettings("Levi", "user-1");

    component.guestNameDraft = "Bob";
    component.confirmGuest();
    component.removeOpponent();

    expect(component.hasOpponent).toBe(false);
    expect(component.players).toHaveLength(1);
    expect(component.players[0]?.type).toBe("user");
  });

  it("adds DartBot with selected level", () => {
    const component = fiveOhOneSettings("Levi", "user-1");

    component.dartbotLevel = 12;
    component.confirmDartBot();

    expect(component.hasOpponent).toBe(true);
    expect(component.players).toHaveLength(2);
    expect(component.players[1]).toEqual({
      id: expect.any(String),
      type: "dartbot",
      name: "DartBot",
      level: 12,
    });
  });

  it("exposes dartbot level preview from shared formatter", () => {
    const component = fiveOhOneSettings("Levi", "user-1");

    component.dartbotLevel = 10;

    expect(component.dartbotLevelPreview).toEqual({
      threeDartAverage: "67–77",
      checkoutAverage: "30",
      checkoutSuccessRate: "55%",
    });
  });

  it("serializes DartBot player using current slider level", () => {
    const component = fiveOhOneSettings("Levi", "user-1");
    component.dartbotLevel = 5;
    component.confirmDartBot();
    component.dartbotLevel = 9;

    const serialized = JSON.parse(component.serializePlayers());
    expect(serialized[1]).toMatchObject({
      type: "dartbot",
      name: "DartBot",
      level: 9,
    });
  });
});
