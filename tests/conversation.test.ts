import { describe, expect, test } from "bun:test";
import { ChatLock } from "../src/bot/chatLock";
import { Conversation } from "../src/bot/conversation";
import { texts } from "../src/bot/texts";
import type { BrainEvent } from "../src/brain/types";
import { openDb } from "../src/store/db";
import { SessionStore } from "../src/store/sessions";
import { FakeBrain } from "./helpers/fakeBrain";
import { FakeTelegram } from "./helpers/fakeTelegram";

const NOW = new Date("2026-11-26T10:00:00Z");
const config = { turnTimeoutSec: 5, idleResetHours: 6, chunkMax: 1200, chunkDelayMs: 0, tzName: "Europe/Istanbul" };
const long = (ch: string) => ch.repeat(400);

function setup(script: ConstructorParameters<typeof FakeBrain>[0]) {
  const tg = new FakeTelegram();
  const brain = new FakeBrain(script);
  const sessions = new SessionStore(openDb(":memory:"));
  const conv = new Conversation({
    brain,
    sessions,
    lock: new ChatLock(),
    tg,
    config,
    now: () => NOW,
    sleep: async () => {},
  });
  return { tg, brain, sessions, conv };
}

const happy: BrainEvent[] = [
  { type: "session", sessionId: "s1" },
  { type: "message", text: "Bakıyorum." },
  { type: "tool_start", tool: "web_search_exa", detail: "haber" },
  { type: "message", text: `${long("a")}\n\n${long("b")}` },
  { type: "turn_done" },
];

describe("Conversation.runTurn", () => {
  test("new session: persona prompt, status, chunked answer, session saved", async () => {
    const { tg, brain, sessions, conv } = setup(() => happy);
    await conv.runTurn(1, "Neler oldu?");
    expect(brain.calls[0]!.sessionId).toBeUndefined();
    expect(brain.calls[0]!.prompt).toContain("You are Aldis");
    const sent = tg.sentTexts();
    expect(sent[0]).toBe("🔎 Arıyorum: haber");
    expect(sent.slice(1)).toEqual([long("a"), long("b")]);
    expect(tg.calls.some((c) => c.method === "deleteMessage")).toBe(true);
    expect(sessions.get(1)?.sessionId).toBe("s1");
    expect(conv.lastTurn?.ok).toBe(true);
  });

  test("resumes a recent session without persona", async () => {
    const { brain, sessions, conv } = setup(() => happy);
    sessions.set(1, "old", NOW.getTime() - 60_000);
    await conv.runTurn(1, "Peki?");
    expect(brain.calls[0]!.sessionId).toBe("old");
    expect(brain.calls[0]!.prompt).not.toContain("You are Aldis");
  });

  test("idle session is reset", async () => {
    const { brain, sessions, conv } = setup(() => happy);
    sessions.set(1, "old", NOW.getTime() - 7 * 3_600_000);
    await conv.runTurn(1, "Selam");
    expect(brain.calls[0]!.sessionId).toBeUndefined();
  });

  test("fresh option ignores current session", async () => {
    const { brain, sessions, conv } = setup(() => happy);
    sessions.set(1, "old", NOW.getTime());
    await conv.runTurn(1, "brief", { fresh: true });
    expect(brain.calls[0]!.sessionId).toBeUndefined();
    expect(sessions.get(1)?.sessionId).toBe("s1");
  });

  test("busy chat gets busy text", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { tg, conv } = setup(async () => {
      await gate;
      return happy;
    });
    const first = conv.runTurn(1, "a");
    await conv.runTurn(1, "b");
    expect(tg.sentTexts()).toContain(texts.busy);
    release();
    await first;
  });

  test("error without answer sends friendly error", async () => {
    const { tg, conv } = setup(() => [{ type: "error", message: "You've hit your usage limit" }]);
    await conv.runTurn(1, "x");
    expect(tg.sentTexts().at(-1)).toContain("kota");
    expect(conv.lastTurn?.ok).toBe(false);
  });

  test("empty answer", async () => {
    const { tg, conv } = setup(() => [{ type: "turn_done" }]);
    await conv.runTurn(1, "x");
    expect(tg.sentTexts().at(-1)).toBe(texts.empty);
  });

  test("bad resumed session is cleared", async () => {
    const { sessions, conv } = setup(() => [{ type: "error", message: "session not found: old" }]);
    sessions.set(1, "old", NOW.getTime());
    await conv.runTurn(1, "x");
    expect(sessions.get(1)).toBeNull();
  });
});
