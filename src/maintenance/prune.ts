import type { Dirent } from "node:fs";
import { readdir, rm, rmdir, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Deletes Codex rollout files (`*.jsonl`) older than `maxAgeDays` under `root`
 * and removes the directories that become empty. `root` itself is kept.
 * Returns how many files were deleted.
 */
export async function pruneOldSessions(root: string, maxAgeDays: number, now: number = Date.now()): Promise<number> {
  const cutoff = now - maxAgeDays * 86_400_000;
  let removed = 0;

  async function walk(dir: string): Promise<boolean> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    let remaining = entries.length;
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (await walk(path)) {
          await rmdir(path).catch(() => {});
          remaining--;
        }
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        const info = await stat(path);
        if (info.mtimeMs < cutoff) {
          await rm(path);
          removed++;
          remaining--;
        }
      }
    }
    return remaining === 0;
  }

  await walk(root);
  return removed;
}
