import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruneOldSessions } from "../src/maintenance/prune";

const DAY = 86_400_000;

describe("pruneOldSessions", () => {
  test("deletes old jsonl and empty dirs only", async () => {
    const root = await mkdtemp(join(tmpdir(), "aldis-prune-"));
    const oldDir = join(root, "2026", "11", "01");
    const newDir = join(root, "2026", "11", "26");
    await mkdir(oldDir, { recursive: true });
    await mkdir(newDir, { recursive: true });
    const now = Date.now();
    const oldFile = join(oldDir, "rollout-old.jsonl");
    const newFile = join(newDir, "rollout-new.jsonl");
    const otherOld = join(newDir, "notes.txt");
    for (const f of [oldFile, newFile, otherOld]) await writeFile(f, "{}");
    const past = new Date(now - 10 * DAY);
    await utimes(oldFile, past, past);
    await utimes(otherOld, past, past);

    expect(await pruneOldSessions(root, 7, now)).toBe(1);
    expect(existsSync(oldFile)).toBe(false);
    expect(existsSync(oldDir)).toBe(false);
    expect(existsSync(newFile)).toBe(true);
    expect(existsSync(otherOld)).toBe(true);
    expect(existsSync(root)).toBe(true);
  });

  test("missing root is fine", async () => {
    expect(await pruneOldSessions("/nonexistent/aldis", 7)).toBe(0);
  });
});
