// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { fiveOhOneSettings } from "@lib/client/alpine/games/501.settings";

describe("fiveOhOneSettings", () => {
  it("defaults to one user player and no guest", () => {
    const component = fiveOhOneSettings("Levi", "user-1");

    expect(component.matchMode).toBe("best-of");
    expect(component.unit).toBe("legs");
    expect(component.players).toHaveLength(1);
    expect(component.players[0]).toEqual({
      id: "user-1",
      type: "user",
      name: "Levi",
    });
    expect(component.hasGuest).toBe(false);
  });

  it("adds a guest via confirmGuest", () => {
    const component = fiveOhOneSettings("Levi", "user-1");

    component.guestNameDraft = "Bob";
    component.confirmGuest();

    expect(component.hasGuest).toBe(true);
    expect(component.players).toHaveLength(2);
    expect(component.players[1]?.name).toBe("Bob");
    expect(component.players[1]?.type).toBe("guest");
  });

  it("removes guest player", () => {
    const component = fiveOhOneSettings("Levi", "user-1");

    component.guestNameDraft = "Bob";
    component.confirmGuest();
    component.removeGuest();

    expect(component.hasGuest).toBe(false);
    expect(component.players).toHaveLength(1);
    expect(component.players[0]?.type).toBe("user");
  });
});
