import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { CodexBrain, childEnv } from "../src/brain/codex";
import type { BrainEvent } from "../src/brain/types";

const fake = resolve(import.meta.dir, "fixtures/fake-codex.ts");
const brain = new CodexBrain({ bin: fake, codexHome: "/tmp/aldis-codex-home", workDir: "/tmp", exaApiKey: "" });

async function collect(it: AsyncIterable<BrainEvent>): Promise<BrainEvent[]> {
  const out: BrainEvent[] = [];
  for await (const ev of it) out.push(ev);
  return out;
}

describe("CodexBrain", () => {
  test("streams events from a new session with sanitized env", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "secret";
    const events = await collect(brain.run({ prompt: "hello" }));
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(events[0]).toEqual({ type: "session", sessionId: "thread-new-123" });
    expect(events).toContainEqual({ type: "tool_start", tool: "web_search_exa", detail: "news" });
    const messages = events.filter((e) => e.type === "message");
    expect(messages.at(-1)).toEqual({ type: "message", text: "echo:hello|home:/tmp/aldis-codex-home|token:none" });
    expect(events.at(-1)).toEqual({ type: "turn_done" });
  });

  test("resumes an existing session", async () => {
    const events = await collect(brain.run({ prompt: "again", sessionId: "t-9" }));
    expect(events[0]).toEqual({ type: "session", sessionId: "t-9" });
  });

  test("reports non-zero exit with stderr", async () => {
    const events = await collect(brain.run({ prompt: "FAIL" }));
    expect(events.at(-1)).toEqual({ type: "error", message: "fatal: something broke" });
  });

  test("reports a turn that never completed", async () => {
    const events = await collect(brain.run({ prompt: "NODONE" }));
    expect(events.at(-1)).toEqual({ type: "error", message: "codex ended without completing the turn" });
  });

  test("abort kills the process quickly", async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 200);
    const started = Date.now();
    const events = await collect(brain.run({ prompt: "HANG", signal: ac.signal }));
    expect(Date.now() - started).toBeLessThan(5000);
    expect(events.at(-1)).toEqual({ type: "error", message: "aborted" });
  });

  test("childEnv keeps only safe vars", () => {
    expect(childEnv("/h", { PATH: "/bin", HOME: "/home/x", TELEGRAM_BOT_TOKEN: "s", EXA_API_KEY: "k" })).toEqual({
      CODEX_HOME: "/h",
      PATH: "/bin",
      HOME: "/home/x",
    });
  });
});
