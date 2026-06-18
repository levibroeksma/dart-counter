import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { bootstrapEnv } from "../src/lib/server/bootstrap-env";

bootstrapEnv();

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL (or DATABASE_URL_UNPOOLED) is not set. Check app/.env.",
  );
  process.exit(1);
}

const host = connectionString.match(/@([^/]+)/)?.[1] ?? "unknown";
console.log(`Migrating database at ${host} via Neon HTTP...`);

const sql = neon(connectionString);
const db = drizzle({ client: sql });

await migrate(db, { migrationsFolder: "./drizzle/migrations" });

const columns = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'game_catalog'
  ORDER BY ordinal_position
`;
const columnNames = columns.map((row) => row.column_name as string);

if (!columnNames.includes("entry_env")) {
  console.error(
    "Migration finished but game_catalog.entry_env is still missing.",
  );
  process.exit(1);
}

console.log("Migrations applied successfully.");
console.log(`game_catalog columns: ${columnNames.join(", ")}`);
