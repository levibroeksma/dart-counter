// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tenUpOneDownSettings } from "@lib/client/alpine/games/ten-up-one-down.settings";

describe("tenUpOneDownSettings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    document.body.innerHTML = `
      <form id="game-settings-form">
        <input name="endMode" value="rounds" />
        <input name="roundCount" value="10" />
      </form>
    `;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("POSTs session and navigates on success", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true, session: {} }),
    } as Response);

    const component = tenUpOneDownSettings("/games/ten-up-one-down", false);
    await component.start();

    expect(fetch).toHaveBeenCalledWith(
      "/api/games/ten-up-one-down/session",
      expect.objectContaining({ method: "POST" })
    );
    expect(window.location.href).toBe("/games/ten-up-one-down");
  });

  it("converts playtime minutes to seconds", () => {
    const component = tenUpOneDownSettings("/games/ten-up-one-down", false);

    const form = document.createElement("form");
    form.innerHTML = `
      <input name="endMode" value="timed" />
      <input name="playtimeMinutes" value="10" />
    `;

    const settings = component.formDataToSettings(form);

    expect(settings).toEqual({
      endMode: "timed",
      playtimeSeconds: 600,
    });
    expect(settings).not.toHaveProperty("playtimeMinutes");
  });
});
