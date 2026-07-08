import { bootstrapEnv } from '../src/lib/server/bootstrap-env';
import {
  DEV_AUTH_DEFAULTS,
  resolveDevAuthUserId,
} from '../src/lib/server/ensure-neon-auth-user';
import { seedPlayerStatCompletions } from '../src/lib/server/data/seed-player-stat-completions';

bootstrapEnv();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Check app/.env or .env.local.');
  process.exit(1);
}

if (!process.env.NEON_AUTH_BASE_URL) {
  console.error('NEON_AUTH_BASE_URL is not set. Check app/.env or .env.local.');
  process.exit(1);
}

try {
  const userId = await resolveDevAuthUserId();
  const email = process.env.SEED_AUTH_EMAIL ?? DEV_AUTH_DEFAULTS.email;
  const dbHost = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).host
    : 'unknown';
  const { completionsInserted } = await seedPlayerStatCompletions(userId);

  console.log(`Seeded ${completionsInserted} stat completions for ${email}`);
  console.log(`User id: ${userId}`);
  console.log(`Database host: ${dbHost}`);
  console.log('Log in with that account, then open http://localhost:4321/');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
