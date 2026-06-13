// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { displayNameSetting } from "@lib/client/alpine/settings/display-name.setting";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("displayNameSetting", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in empty mode when no initial name", () => {
    const component = displayNameSetting("");
    expect(component.mode).toBe("empty");
    expect(component.displayName).toBe("");
    expect(component.draft).toBe("");
  });

  it("starts in view mode when initial name is set", () => {
    const component = displayNameSetting("Alex");
    expect(component.mode).toBe("view");
    expect(component.displayName).toBe("Alex");
  });

  it("enters edit mode from view", () => {
    const component = displayNameSetting("Alex");
    component.startEdit();
    expect(component.mode).toBe("edit");
    expect(component.draft).toBe("Alex");
  });

  it("shows validation error for invalid draft without fetching", async () => {
    const component = displayNameSetting("");
    component.draft = "A";
    await component.save();
    expect(fetch).not.toHaveBeenCalled();
    expect(component.error).toBe("Display name must be 2–20 characters");
  });

  it("saves valid name and switches to view mode", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true, displayName: "Alex" }),
    } as Response);

    const component = displayNameSetting("");
    component.draft = "Alex";
    await component.save();

    expect(fetch).toHaveBeenCalledWith("/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Alex" }),
    });
    expect(component.displayName).toBe("Alex");
    expect(component.mode).toBe("view");
    expect(component.error).toBe("");
  });

  it("clears name and switches to empty mode", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: true }),
    } as Response);

    const component = displayNameSetting("Alex");
    component.startEdit();
    component.draft = "   ";
    await component.save();

    expect(fetch).toHaveBeenCalledWith("/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "   " }),
    });
    expect(component.displayName).toBe("");
    expect(component.mode).toBe("empty");
  });

  it("shows API error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ ok: false, code: MessageCode.SERVER_ERROR }),
    } as Response);

    const component = displayNameSetting("");
    component.draft = "Alex";
    await component.save();

    expect(component.error).toBe("Something went wrong. Please try again.");
    expect(component.loading).toBe(false);
  });
});
