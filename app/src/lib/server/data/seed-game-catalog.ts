import { db, gameCatalog } from "@db/index";
import { CATALOG_ENTRY_ENV } from "@lib/shared/constants/entry-env";
import { SEED_GAMES } from "@lib/shared/games/types";

/**
 * Upsert all SEED_GAMES into game_catalog. Run at migrate/deploy time, not during SSR.
 */
export async function seedGameCatalog(): Promise<void> {
  for (const game of SEED_GAMES) {
    await db
      .insert(gameCatalog)
      .values({
        slug: game.slug,
        entryEnv: CATALOG_ENTRY_ENV,
        displayName: game.displayName,
        sortOrder: game.sortOrder,
        enabled: game.enabled,
        released: game.released,
      })
      .onConflictDoUpdate({
        target: gameCatalog.slug,
        set: {
          displayName: game.displayName,
          sortOrder: game.sortOrder,
          enabled: game.enabled,
          released: game.released,
        },
      });
  }
}
