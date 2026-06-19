# Neon Dev Branching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-provision a Neon dev branch matching the git branch when `npm run dev` runs, pull credentials into `.env.local`, migrate, then start Astro.

**Architecture:** `scripts/dev.ts` orchestrates `ensure-neon-dev-branch.ts` (neonctl checkout + env pull + db:migrate) before spawning `astro dev`. `bootstrap-env.ts` loads `.env.local` with override semantics so dev branch URLs win over `.env`.

**Tech Stack:** TypeScript, `neonctl` (npx), Astro 6, Drizzle, Vitest

**Spec:** `docs/superpowers/specs/2026-06-19-neon-dev-branching-design.md`  
**Working directory:** `app/` (all commands run from here unless noted)

---

## File Map

| File | Responsibility |
| ---- | -------------- |
| `src/lib/server/neon-dev-branch.ts` | Pure `resolveNeonDevBranchName(gitBranch)` |
| `scripts/ensure-neon-dev-branch.ts` | neonctl checkout, env pull, migrate |
| `scripts/dev.ts` | Dev entrypoint: ensure branch → astro dev |
| `src/lib/server/bootstrap-env.ts` | Env load with later-file override |
| `tests/lib/server/neon-dev-branch.test.ts` | Branch name unit tests |

---

### Task 1: Branch name resolver

**Files:**
- Create: `app/src/lib/server/neon-dev-branch.ts`
- Test: `app/tests/lib/server/neon-dev-branch.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/server/neon-dev-branch.test.ts
import { describe, expect, it } from "vitest";
import { resolveNeonDevBranchName } from "@lib/server/neon-dev-branch";

describe("resolveNeonDevBranchName", () => {
  it("maps main to dev", () => {
    expect(resolveNeonDevBranchName("main")).toBe("dev");
  });

  it("maps master to dev", () => {
    expect(resolveNeonDevBranchName("master")).toBe("dev");
  });

  it("uses git branch name as-is when valid", () => {
    expect(resolveNeonDevBranchName("performance-optimizations")).toBe(
      "performance-optimizations",
    );
  });

  it("replaces slashes with dashes", () => {
    expect(resolveNeonDevBranchName("feature/foo")).toBe("feature-foo");
  });

  it("lowercases and strips invalid characters", () => {
    expect(resolveNeonDevBranchName("Feature/FOO_bar")).toBe("feature-foo-bar");
  });

  it("returns dev for empty input", () => {
    expect(resolveNeonDevBranchName("")).toBe("dev");
    expect(resolveNeonDevBranchName(null)).toBe("dev");
    expect(resolveNeonDevBranchName(undefined)).toBe("dev");
  });

  it("truncates to 63 characters", () => {
    const long = "a".repeat(80);
    expect(resolveNeonDevBranchName(long)).toHaveLength(63);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/server/neon-dev-branch.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/server/neon-dev-branch.ts
const MAX_BRANCH_NAME_LENGTH = 63;

/**
 * Map a git branch name to a Neon branch name for local dev isolation.
 */
export function resolveNeonDevBranchName(
  gitBranch: string | null | undefined,
): string {
  const trimmed = gitBranch?.trim();
  if (!trimmed || trimmed === "main" || trimmed === "master") {
    return "dev";
  }

  const sanitized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!sanitized) return "dev";
  return sanitized.slice(0, MAX_BRANCH_NAME_LENGTH);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/server/neon-dev-branch.test.ts`  
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/server/neon-dev-branch.ts app/tests/lib/server/neon-dev-branch.test.ts
git commit -m "feat: add Neon dev branch name resolver"
```

---

### Task 2: Fix bootstrap-env override semantics

**Files:**
- Modify: `app/src/lib/server/bootstrap-env.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/server/bootstrap-env.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("bootstrapEnv", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  afterEach(() => {
    process.chdir(originalCwd);
    vi.resetModules();
    delete process.env.BOOTSTRAP_TEST_KEY;
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("lets .env.local override .env", async () => {
    tempDir = join(tmpdir(), `bootstrap-env-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, ".env"), "BOOTSTRAP_TEST_KEY=from-env\n");
    writeFileSync(join(tempDir, ".env.local"), "BOOTSTRAP_TEST_KEY=from-local\n");

    process.chdir(tempDir);
    const { bootstrapEnv } = await import("@lib/server/bootstrap-env");
    bootstrapEnv();

    expect(process.env.BOOTSTRAP_TEST_KEY).toBe("from-local");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/server/bootstrap-env.test.ts`  
Expected: FAIL — value is `from-env`

- [ ] **Step 3: Update bootstrap-env.ts**

Change `loadEnvFile` to accept an `override` parameter (default `false`). When `override` is true, always set keys. Load chain:

```typescript
loadEnvFile(resolve(cwd, ".env"));
loadEnvFile(resolve(cwd, ".env.local"), true);
loadEnvFile(resolve(cwd, `.env.${mode}`));
loadEnvFile(resolve(cwd, `.env.${mode}.local`), true);
```

Inside `loadEnvFile`:

```typescript
function loadEnvFile(filePath: string, override = false): void {
  // ...parse key/value...
  if (override || !process.env[key]) {
    process.env[key] = value;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npm test -- tests/lib/server/bootstrap-env.test.ts`  
Expected: PASS

Also run full suite: `cd app && npm test`  
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/server/bootstrap-env.ts app/tests/lib/server/bootstrap-env.test.ts
git commit -m "fix: let .env.local override .env in bootstrap-env"
```

---

### Task 3: ensure-neon-dev-branch script

**Files:**
- Create: `app/scripts/ensure-neon-dev-branch.ts`

- [ ] **Step 1: Implement script**

```typescript
// app/scripts/ensure-neon-dev-branch.ts
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveNeonDevBranchName } from "../src/lib/server/neon-dev-branch";

const NEONCTL = "npx";
const NEONCTL_ARGS = ["-y", "neonctl@latest"];

function runNeonctl(args: string[]): void {
  const result = spawnSync(NEONCTL, [...NEONCTL_ARGS, ...args], {
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

function shouldSkip(): boolean {
  return (
    process.env.SKIP_NEON_DEV_BRANCH === "1" ||
    process.env.CI === "true" ||
    process.env.CI === "1"
  );
}

export async function ensureNeonDevBranch(): Promise<void> {
  if (shouldSkip()) {
    console.log("[neon-dev] Skipping dev branch setup (CI or SKIP_NEON_DEV_BRANCH)");
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

  if (!branchExists(projectId, branchName)) {
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

  runNeonctl([
    "checkout",
    branchName,
    "--project-id",
    projectId,
    "--no-env-pull",
  ]);

  runNeonctl(["env", "pull", "--project-id", projectId, "--file", ".env.local"]);

  console.log("[neon-dev] Running migrations...");
  const migrate = spawnSync("npm", ["run", "db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
  }

  console.log(`[neon-dev] Ready (branch: ${branchName})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await ensureNeonDevBranch();
}
```

Note: `db:migrate` uses `bootstrapEnv()` which now reads `.env.local` after this script creates it. The migrate subprocess inherits `process.env` but `db-migrate.ts` calls `bootstrapEnv()` fresh — ensure `.env.local` exists on disk before migrate (env pull writes it).

- [ ] **Step 2: Smoke test (manual, requires Neon auth)**

Run: `cd app && npx tsx scripts/ensure-neon-dev-branch.ts`  
Expected: creates/checks out branch, writes `.env.local`, migrates successfully

- [ ] **Step 3: Commit**

```bash
git add app/scripts/ensure-neon-dev-branch.ts
git commit -m "feat: add ensure-neon-dev-branch script"
```

---

### Task 4: Dev entrypoint and package.json

**Files:**
- Create: `app/scripts/dev.ts`
- Modify: `app/package.json`
- Modify: `app/.gitignore`
- Modify: `app/.env.example`

- [ ] **Step 1: Create dev.ts**

```typescript
// app/scripts/dev.ts
import { spawn } from "node:child_process";
import { ensureNeonDevBranch } from "./ensure-neon-dev-branch";

await ensureNeonDevBranch();

const child = spawn("npx", ["astro", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
```

- [ ] **Step 2: Update package.json**

```json
"dev": "npx tsx scripts/dev.ts",
"dev:astro": "astro dev",
```

`dev:astro` escape hatch skips Neon setup.

- [ ] **Step 3: Update .gitignore**

Add under environment variables section:

```
.env.local
```

- [ ] **Step 4: Update .env.example**

Add section:

```
# Dev branching (automatic on npm run dev)
# neonctl writes branch-specific Neon vars to .env.local (gitignored).
# Set SKIP_NEON_DEV_BRANCH=1 to use .env credentials without provisioning.
# NEON_BRANCH is set automatically by neonctl env pull.
```

Fix typo `DATABASE_URL_UN1ED` → `DATABASE_URL_UNPOOLED` if still present.

- [ ] **Step 5: Verification**

Run: `cd app && npm run check && npm test && npm run build`  
Expected: all pass

Manual: `cd app && npm run dev`  
Expected: `[neon-dev] Checking out Neon branch: performance-optimizations`, server starts on :4321

- [ ] **Step 6: Commit**

```bash
git add app/scripts/dev.ts app/package.json app/.gitignore app/.env.example
git commit -m "feat: auto-provision Neon dev branch on npm run dev"
```

---

## Verification Gate (final)

```bash
cd app && npm run check && npm test && npm run build
```

Manual dev loop:

1. `npm run dev` — branch created, `.env.local` written
2. Confirm `NEON_BRANCH` in `.env.local` matches git branch
3. `SKIP_NEON_DEV_BRANCH=1 npm run dev` — skips neonctl, uses `.env` only
4. `npm run dev:astro` — direct astro, no neon setup
