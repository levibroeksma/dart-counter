import { getStore } from "@netlify/blobs";

export type UserPreferences = {
  displayName?: string;
};

const STORE_NAME = "user-preferences";
const KEY = "default";

/**
 * Read user preferences from Netlify Blobs.
 */
export async function getPreferences(): Promise<UserPreferences> {
  const store = getStore(STORE_NAME);
  const data = await store.get(KEY, { type: "json" });
  if (!data) {
    return {};
  }
  return data as UserPreferences;
}

/**
 * Persist user preferences to Netlify Blobs.
 */
export async function setPreferences(prefs: UserPreferences): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(KEY, prefs);
}
