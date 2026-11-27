import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

export const CODE_MODE_HOST = "codex-code-mode-host";

/**
 * Codex runs tool calls (Exa MCP included) through a sibling `codex-code-mode-host`
 * binary. Without it Codex still answers, but every search silently fails.
 * Returns a problem description, or null when the install looks complete.
 */
export function checkCodexInstall(bin: string, path: string | undefined = process.env.PATH): string | null {
  const resolved = Bun.which(bin, { PATH: path ?? "" });
  if (!resolved) return `codex binary "${bin}" not found on PATH`;
  const dirs = new Set([dirname(resolved), dirname(realpathSync(resolved))]);
  for (const dir of dirs) {
    if (existsSync(join(dir, CODE_MODE_HOST))) return null;
  }
  return `${CODE_MODE_HOST} not found next to ${resolved}; searches will fail. Re-run deploy/setup.sh.`;
}
