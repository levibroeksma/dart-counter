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
    vi.resetModules();
    tempDir = join(tmpdir(), `bootstrap-env-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, ".env"), "BOOTSTRAP_TEST_KEY=from-env\n");
    writeFileSync(
      join(tempDir, ".env.local"),
      "BOOTSTRAP_TEST_KEY=from-local\n",
    );

    process.chdir(tempDir);
    const { bootstrapEnv } = await import("@lib/server/bootstrap-env");
    bootstrapEnv();

    expect(process.env.BOOTSTRAP_TEST_KEY).toBe("from-local");
  });

  it("re-applies .env.local on subsequent bootstrapEnv calls", async () => {
    vi.resetModules();
    tempDir = join(tmpdir(), `bootstrap-env-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, ".env"), "BOOTSTRAP_TEST_KEY=from-env\n");
    writeFileSync(
      join(tempDir, ".env.local"),
      "BOOTSTRAP_TEST_KEY=from-local-v1\n",
    );

    process.chdir(tempDir);
    const { bootstrapEnv } = await import("@lib/server/bootstrap-env");
    bootstrapEnv();
    writeFileSync(
      join(tempDir, ".env.local"),
      "BOOTSTRAP_TEST_KEY=from-local-v2\n",
    );
    bootstrapEnv();

    expect(process.env.BOOTSTRAP_TEST_KEY).toBe("from-local-v2");
  });
});
