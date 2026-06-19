import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bootstrapEnv } from "../src/lib/server/bootstrap-env";
import {
  DEV_AUTH_DEFAULTS,
  ensureNeonAuthUser,
} from "../src/lib/server/ensure-neon-auth-user";
import { resolveNeonDevBranchName } from "../src/lib/server/neon-dev-branch";

const NEONCTL_ARGS = ["-y", "neonctl@latest"];

function runNeonctl(args: string[]): void {
  const result = spawnSync("npx", [...NEONCTL_ARGS, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readGitBranch(): string | null {
  const result = spawnSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  const branch = result.stdout.trim();
  return branch || null;
}

function readProjectId(): string | null {
  const neonFile = resolve(process.cwd(), ".neon");
  if (!existsSync(neonFile)) return null;
  try {
    const parsed = JSON.parse(readFileSync(neonFile, "utf8")) as {
      projectId?: string;
    };
    return parsed.projectId ?? null;
  } catch {
    return null;
  }
}

function branchExists(projectId: string, branchName: string): boolean {
  const result = spawnSync(
    "npx",
    [...NEONCTL_ARGS, "branches", "get", branchName, "--project-id", projectId],
    { stdio: "ignore" },
  );
  return result.status === 0;
}

function ensureBranchExists(projectId: string, branchName: string): void {
  if (branchExists(projectId, branchName)) return;
  console.log(`[neon-dev] Creating Neon branch: ${branchName}`);
  runNeonctl([
    "branches",
    "create",
    "--name",
    branchName,
    "--project-id",
    projectId,
  ]);
}

function shouldSkip(): boolean {
  return (
    process.env.SKIP_NEON_DEV_BRANCH === "1" ||
    process.env.CI === "true" ||
    process.env.CI === "1"
  );
}

/** Pin local dev origin for Neon Auth trusted-domain checks. */
function appendDevOriginToEnvLocal(): void {
  const envLocalPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envLocalPath)) return;

  let contents = readFileSync(envLocalPath, "utf8");
  if (/^SEED_AUTH_ORIGIN=/m.test(contents)) return;

  if (!contents.endsWith("\n")) contents += "\n";
  contents += "SEED_AUTH_ORIGIN=http://localhost:4321\n";
  writeFileSync(envLocalPath, contents);
}

/** Create or check out the Neon dev branch and apply migrations. */
export async function ensureNeonDevBranch(): Promise<void> {
  if (shouldSkip()) {
    console.log(
      "[neon-dev] Skipping dev branch setup (CI or SKIP_NEON_DEV_BRANCH)",
    );
    return;
  }

  const projectId = readProjectId();
  if (!projectId) {
    console.error(
      "[neon-dev] Missing app/.neon project link. Run: npx neonctl link",
    );
    process.exit(1);
  }

  const gitBranch = readGitBranch();
  const branchName = resolveNeonDevBranchName(gitBranch);
  console.log(`[neon-dev] Checking out Neon branch: ${branchName}`);

  ensureBranchExists(projectId, branchName);

  runNeonctl([
    "checkout",
    branchName,
    "--project-id",
    projectId,
    "--no-env-pull",
  ]);

  runNeonctl([
    "env",
    "pull",
    "--project-id",
    projectId,
    "--file",
    ".env.local",
  ]);

  appendDevOriginToEnvLocal();

  console.log("[neon-dev] Running migrations...");
  const migrate = spawnSync("npm", ["run", "db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
  }

  bootstrapEnv();
  console.log("[neon-dev] Ensuring dev auth user...");
  try {
    const authResult = await ensureNeonAuthUser();
    const email =
      process.env.SEED_AUTH_EMAIL ?? DEV_AUTH_DEFAULTS.email;
    console.log(
      `[neon-dev] Auth user ${authResult === "created" ? "created" : "ready"}: ${email}`,
    );
  } catch (error) {
    console.error(
      "[neon-dev] Auth seed failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  console.log(`[neon-dev] Ready (branch: ${branchName})`);
}

const isMain = process.argv[1]?.endsWith("ensure-neon-dev-branch.ts");
if (isMain) {
  await ensureNeonDevBranch();
}
