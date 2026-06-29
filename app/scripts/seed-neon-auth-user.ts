import { bootstrapEnv } from "../src/lib/server/bootstrap-env";
import { ensureNeonAuthUser } from "../src/lib/server/ensure-neon-auth-user";

bootstrapEnv();

const email = process.argv[2] ?? process.env.SEED_AUTH_EMAIL;
const password = process.argv[3] ?? process.env.SEED_AUTH_PASSWORD;
const name = process.argv[4] ?? process.env.SEED_AUTH_NAME;

if (!process.env.NEON_AUTH_BASE_URL) {
  console.error("NEON_AUTH_BASE_URL is not set. Check app/.env or .env.local.");
  process.exit(1);
}

if (process.argv[2] && (!email || !password)) {
  console.error(
    "Usage: npx tsx scripts/seed-neon-auth-user.ts <email> <password> [name]",
  );
  process.exit(1);
}

try {
  const result = await ensureNeonAuthUser({
    email: email || undefined,
    password: password || undefined,
    name: name || undefined,
  });
  const resolvedEmail =
    email ?? process.env.SEED_AUTH_EMAIL ?? "test@example.com";
  console.log(
    result === "created"
      ? `Created auth user: ${resolvedEmail}`
      : `Auth user ready: ${resolvedEmail}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
