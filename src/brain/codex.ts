import { buildCodexArgs } from "./codexArgs";
import { parseCodexLine } from "./codexEvents";
import type { Brain, BrainEvent, BrainRunOptions } from "./types";

export interface CodexBrainOptions {
  bin: string;
  codexHome: string;
  workDir: string;
  exaApiKey: string;
  model?: string;
}

const SAFE_ENV = ["PATH", "HOME", "LANG", "LC_ALL", "TZ"] as const;

/** The child never sees bot secrets (Telegram token etc.), only what Codex needs. */
export function childEnv(
  codexHome: string,
  base: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const env: Record<string, string> = { CODEX_HOME: codexHome };
  for (const key of SAFE_ENV) {
    const v = base[key];
    if (v) env[key] = v;
  }
  return env;
}

async function* readLines(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of stream) {
    buf += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      yield buf.slice(0, nl);
      buf = buf.slice(nl + 1);
    }
  }
  buf += decoder.decode();
  if (buf) yield buf;
}

function tail(text: string, lines: number): string {
  return text.trim().split("\n").slice(-lines).join("\n");
}

/** Runs one turn as a short-lived `codex exec` process and streams its events. */
export class CodexBrain implements Brain {
  constructor(private readonly opts: CodexBrainOptions) {}

  async *run({ prompt, sessionId, signal }: BrainRunOptions): AsyncIterable<BrainEvent> {
    const args = buildCodexArgs({ sessionId, exaApiKey: this.opts.exaApiKey, model: this.opts.model });
    const proc = Bun.spawn([this.opts.bin, ...args], {
      cwd: this.opts.workDir,
      env: childEnv(this.opts.codexHome),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    const onAbort = () => proc.kill("SIGTERM");
    signal?.addEventListener("abort", onAbort, { once: true });
    const stderr = new Response(proc.stderr).text();
    proc.stdin.write(prompt);
    proc.stdin.end();

    let sawDone = false;
    let sawError = false;
    try {
      for await (const line of readLines(proc.stdout)) {
        const ev = parseCodexLine(line);
        if (!ev) continue;
        if (ev.type === "turn_done") sawDone = true;
        if (ev.type === "error") sawError = true;
        yield ev;
      }
      const code = await proc.exited;
      if (signal?.aborted) {
        yield { type: "error", message: "aborted" };
      } else if (code !== 0 && !sawError) {
        yield { type: "error", message: tail(await stderr, 5) || `codex exited with code ${code}` };
      } else if (!sawDone && !sawError) {
        yield { type: "error", message: "codex ended without completing the turn" };
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }
  }
}
