import { eq } from "drizzle-orm";
import { db, userPreferences } from "@db/index";
import { getEntryEnv } from "@lib/shared/constants/entry-env";
import { withEntryEnv } from "@lib/server/data/entry-env";

export type UserPreferences = {
  displayName?: string;
};

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const rows = await db
    .select()
    .from(userPreferences)
    .where(withEntryEnv(userPreferences.entryEnv, eq(userPreferences.userId, userId)))
    .limit(1);

  const row = rows[0];
  if (!row?.displayName) return {};
  return { displayName: row.displayName };
}

export async function setPreferences(
  userId: string,
  prefs: UserPreferences,
): Promise<void> {
  await db
    .insert(userPreferences)
    .values({
      userId,
      entryEnv: getEntryEnv(),
      displayName: prefs.displayName ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.entryEnv],
      set: {
        displayName: prefs.displayName ?? null,
        updatedAt: new Date(),
      },
    });
}
