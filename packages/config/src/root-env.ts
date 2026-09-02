import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

export function findMonorepoRoot(startDir = process.cwd()): string {
  let dir = startDir;
  while (true) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return startDir;
    }
    dir = parent;
  }
}

export function loadRootEnv(startDir = process.cwd()): void {
  const root = findMonorepoRoot(startDir);
  loadDotenv({ path: resolve(root, ".env") });
}
