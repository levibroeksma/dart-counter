import { defineConfig } from "drizzle-kit";
import { bootstrapEnv } from "./src/lib/server/bootstrap-env";

bootstrapEnv();

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});
