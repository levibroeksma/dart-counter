// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { userMenu } from "@lib/client/alpine/layout/user.menu";

describe("userMenu", () => {
  it("starts closed", () => {
    const menu = userMenu();
    expect(menu.open).toBe(false);
  });

  it("toggles open state", () => {
    const menu = userMenu();
    menu.toggle();
    expect(menu.open).toBe(true);
    menu.toggle();
    expect(menu.open).toBe(false);
  });

  it("closes explicitly", () => {
    const menu = userMenu();
    menu.open = true;
    menu.close();
    expect(menu.open).toBe(false);
  });
});
