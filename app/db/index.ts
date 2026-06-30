import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { bootstrapEnv } from "@lib/server/bootstrap-env";
import * as schema from "./schema";

bootstrapEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(connectionString);
export const db = drizzle({ client: sql, schema });
export {
  gameCatalog,
  gameSessions,
  player501Stats,
  playerDartStats,
  playerScoreTrainingStats,
  playerSinglesTrainingStats,
  playerStatCompletions,
  userGamePlayCounts,
  userPreferences,
} from "./schema";
