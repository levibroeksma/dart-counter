// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gameSettingsShell } from "@lib/client/alpine/games/game-settings.shell";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("gameSettingsShell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  function createForm(fields: Record<string, string> = {}) {
    const form = document.createElement("form");
    form.id = "game-settings-form";
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    return form;
  }

  it("collects FormData entries into settings", () => {
    const form = createForm({ startingScore: "501", doubleOut: "true" });
    const component = gameSettingsShell("501", "/games/501");

    expect(component.formDataToSettings(form)).toEqual({
      startingScore: "501",
      doubleOut: "true",
    });
  });

  it("PUTs form settings and navigates to play URL on success", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    createForm({ startingScore: "501" });
    const component = gameSettingsShell("501", "/games/501");

    await component.start();

    expect(fetch).toHaveBeenCalledWith("/api/games/501/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { startingScore: "501" } }),
    });
    expect(window.location.href).toBe("/games/501");
    expect(component.error).toBe("");
    expect(component.loading).toBe(false);
  });

  it("shows inline error on API failure", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: false, code: MessageCode.SERVER_ERROR }),
    } as Response);

    createForm({ startingScore: "501" });
    const component = gameSettingsShell("501", "/games/501");

    await component.start();

    expect(component.error).toBe("Something went wrong. Please try again.");
    expect(component.loading).toBe(false);
  });

  it("shows network error on fetch throw", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network"));

    createForm({ startingScore: "501" });
    const component = gameSettingsShell("501", "/games/501");

    await component.start();

    expect(component.error).toBe("Unable to connect. Please try again.");
    expect(component.loading).toBe(false);
  });
});
