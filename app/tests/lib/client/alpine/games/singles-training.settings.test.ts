// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { singlesTrainingSettings } from "@lib/client/alpine/games/singles-training.settings";

describe("singlesTrainingSettings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collects settings from form values", () => {
    const component = singlesTrainingSettings("/games/singles-training", false);

    const form = document.createElement("form");
    form.innerHTML = `
      <input name="direction" value="high-to-low" />
      <input name="mode" value="hard" />
      <input name="scoring" value="uniform" />
    `;

    const settings = component.formDataToSettings(form);
    expect(settings).toEqual({
      direction: "high-to-low",
      mode: "hard",
      scoring: "uniform",
    });
  });

  it("posts settings and redirects on start", async () => {
    document.body.innerHTML = `
      <form id="game-settings-form">
        <input name="direction" value="random" />
        <input name="mode" value="extreme" />
        <input name="scoring" value="traditional" />
      </form>
    `;

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    const component = singlesTrainingSettings("/games/singles-training", false);
    await component.start();

    expect(fetch).toHaveBeenCalledWith(
      "/api/games/singles-training/session",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(window.location.href).toBe("/games/singles-training");
  });
});
