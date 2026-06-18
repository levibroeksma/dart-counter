import { bootstrapEnv } from "../src/lib/server/bootstrap-env";

bootstrapEnv();

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const email = process.argv[2] ?? process.env.SEED_AUTH_EMAIL;
const password = process.argv[3] ?? process.env.SEED_AUTH_PASSWORD;
const name = process.argv[4] ?? process.env.SEED_AUTH_NAME ?? "Dart Counter User";

if (!baseUrl || !email || !password) {
  console.error(
    "Usage: npx tsx scripts/seed-neon-auth-user.ts <email> <password> [name]\n" +
      "Or set NEON_AUTH_BASE_URL, SEED_AUTH_EMAIL, SEED_AUTH_PASSWORD"
  );
  process.exit(1);
}

const response = await fetch(`${baseUrl}/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, name }),
});

const body = await response.text();
if (!response.ok) {
  console.error(`Seed failed (${response.status}):`, body);
  process.exit(1);
}

console.log(`Seeded Neon Auth user: ${email}`);
