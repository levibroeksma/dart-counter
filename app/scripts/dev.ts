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
