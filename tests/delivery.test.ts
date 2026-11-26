import { describe, expect, test } from "bun:test";
import { sendChunks, sendFormatted } from "../src/delivery/sender";
import { StatusMessage, describeTool } from "../src/delivery/status";
import { FakeTelegram } from "./helpers/fakeTelegram";

describe("sender", () => {
  test("sends html with previews disabled", async () => {
    const tg = new FakeTelegram();
    await sendFormatted(tg, 1, "**hi**");
    expect(tg.calls[0]).toMatchObject({
      text: "<b>hi</b>",
      other: { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
    });
  });

  test("falls back to plain text on parse error", async () => {
    const tg = new FakeTelegram();
    tg.failHtmlOnce = true;
    await sendFormatted(tg, 1, "**hi**");
    expect(tg.calls).toHaveLength(1);
    expect(tg.calls[0]).toMatchObject({ text: "**hi**", other: { link_preview_options: { is_disabled: true } } });
    expect(tg.calls[0]!.other?.parse_mode).toBeUndefined();
  });

  test("sends chunks in order with typing between", async () => {
    const tg = new FakeTelegram();
    const slept: number[] = [];
    await sendChunks(tg, 1, ["a", "b", "c"], { delayMs: 900, sleep: async (ms) => void slept.push(ms) });
    expect(tg.sentTexts()).toEqual(["a", "b", "c"]);
    expect(tg.calls.map((c) => c.method)).toEqual([
      "sendMessage",
      "sendChatAction",
      "sendMessage",
      "sendChatAction",
      "sendMessage",
    ]);
    expect(slept).toEqual([900, 900]);
  });
});

describe("StatusMessage", () => {
  test("creates, throttles edits, then deletes", async () => {
    const tg = new FakeTelegram();
    let t = 0;
    const status = new StatusMessage(tg, 1, { minIntervalMs: 1000, now: () => t });
    await status.show("one");
    t = 500;
    await status.show("two"); // throttled
    t = 2000;
    await status.show("three");
    await status.show("three"); // unchanged
    await status.clear();
    await status.clear(); // no-op
    expect(tg.calls.map((c) => `${c.method}:${c.text ?? c.messageId}`)).toEqual([
      "sendMessage:one",
      "editMessageText:three",
      "deleteMessage:1",
    ]);
  });

  test("describeTool", () => {
    expect(describeTool("web_search_exa", "son dakika")).toBe("🔎 Arıyorum: son dakika");
    expect(describeTool("web_fetch_exa", "https://a.com")).toBe("📄 Okuyorum: https://a.com");
    expect(describeTool("other")).toBe("🛠 other");
    expect(describeTool("web_search_exa", "x".repeat(200)).length).toBeLessThan(100);
  });
});
