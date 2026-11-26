/** Codex features turned off so the model can only talk and use Exa. */
export const DISABLED_FEATURES = [
  "shell_tool",
  "unified_exec",
  "apps",
  "plugins",
  "browser_use",
  "in_app_browser",
  "computer_use",
  "view_image",
] as const;

export interface CodexArgsOptions {
  sessionId?: string;
  exaApiKey: string;
  model?: string;
}

export function exaMcpUrl(key: string): string {
  const base = "https://mcp.exa.ai/mcp";
  return key ? `${base}?exaApiKey=${encodeURIComponent(key)}` : base;
}

/**
 * argv for `codex exec` (new) or `codex exec resume <id>`.
 * `resume` rejects `-s`, so the sandbox is set through `-c` for both.
 */
export function buildCodexArgs({ sessionId, exaApiKey, model }: CodexArgsOptions): string[] {
  const args = ["exec"];
  if (sessionId) args.push("resume", sessionId);
  args.push("--json", "--skip-git-repo-check", "--ignore-user-config");
  args.push("-c", 'sandbox_mode="read-only"');
  for (const feature of DISABLED_FEATURES) args.push("--disable", feature);
  args.push("-c", `mcp_servers.exa.url="${exaMcpUrl(exaApiKey)}"`);
  if (model) args.push("-m", model);
  args.push("-");
  return args;
}
