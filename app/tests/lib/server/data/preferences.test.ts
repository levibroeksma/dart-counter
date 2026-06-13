import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSetJSON = vi.fn();

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => ({
    get: mockGet,
    setJSON: mockSetJSON,
  })),
}));

import { getPreferences, setPreferences } from "@lib/server/data/preferences";

describe("preferences", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetJSON.mockReset();
  });

  it("returns empty object when blob is missing", async () => {
    mockGet.mockResolvedValue(null);
    await expect(getPreferences()).resolves.toEqual({});
  });

  it("returns stored preferences", async () => {
    mockGet.mockResolvedValue({ displayName: "Alex" });
    await expect(getPreferences()).resolves.toEqual({ displayName: "Alex" });
  });

  it("writes preferences to blob store", async () => {
    await setPreferences({ displayName: "Alex" });
    expect(mockSetJSON).toHaveBeenCalledWith("default", {
      displayName: "Alex",
    });
  });

  it("writes empty object when clearing display name", async () => {
    await setPreferences({});
    expect(mockSetJSON).toHaveBeenCalledWith("default", {});
  });
});
