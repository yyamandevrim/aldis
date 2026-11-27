import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCodexInstall } from "../src/brain/codexPreflight";

async function binDir(files: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aldis-bin-"));
  for (const f of files) {
    const p = join(dir, f);
    await writeFile(p, "#!/bin/sh\n");
    await chmod(p, 0o755);
  }
  return dir;
}

describe("checkCodexInstall", () => {
  test("ok when the host sits next to codex", async () => {
    const dir = await binDir(["codex", "codex-code-mode-host"]);
    expect(checkCodexInstall("codex", dir)).toBeNull();
  });

  test("reports a missing code-mode host", async () => {
    const dir = await binDir(["codex"]);
    expect(checkCodexInstall("codex", dir)).toContain("codex-code-mode-host not found");
  });

  test("reports a missing codex binary", async () => {
    const dir = await binDir([]);
    expect(checkCodexInstall("codex", dir)).toContain("not found on PATH");
  });
});
