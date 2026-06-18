import { describe, it, expect, beforeEach } from "vitest";
import "@tests/helpers/mock-db";
import { mockDb, TEST_ENTRY_ENV, userScopedKey } from "@tests/helpers/mock-db";
import { TEST_USER_ID } from "@tests/helpers/constants";
import { getPreferences, setPreferences } from "@lib/server/data/preferences";

describe("preferences", () => {
  beforeEach(() => mockDb.reset());

  it("returns empty object when row is missing", async () => {
    await expect(getPreferences(TEST_USER_ID)).resolves.toEqual({});
  });

  it("returns stored preferences", async () => {
    mockDb.tables.userPreferences.set(userScopedKey(TEST_USER_ID), {
      userId: TEST_USER_ID,
      entryEnv: TEST_ENTRY_ENV,
      displayName: "Alex",
      updatedAt: new Date(),
    });
    await expect(getPreferences(TEST_USER_ID)).resolves.toEqual({
      displayName: "Alex",
    });
  });

  it("writes preferences via upsert", async () => {
    await setPreferences(TEST_USER_ID, { displayName: "Alex" });
    const row = mockDb.tables.userPreferences.get(userScopedKey(TEST_USER_ID));
    expect(row?.displayName).toBe("Alex");
  });

  it("writes empty object when clearing display name", async () => {
    await setPreferences(TEST_USER_ID, {});
    const row = mockDb.tables.userPreferences.get(userScopedKey(TEST_USER_ID));
    expect(row?.displayName).toBeNull();
  });
});
