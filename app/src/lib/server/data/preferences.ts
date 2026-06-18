import { eq } from "drizzle-orm";
import { db, userPreferences } from "@db/index";

export type UserPreferences = {
  displayName?: string;
};

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
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
      displayName: prefs.displayName ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        displayName: prefs.displayName ?? null,
        updatedAt: new Date(),
      },
    });
}
