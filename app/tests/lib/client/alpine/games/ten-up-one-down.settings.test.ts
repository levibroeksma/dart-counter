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
});
