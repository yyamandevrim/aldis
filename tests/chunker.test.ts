import { describe, expect, test } from "bun:test";
import { chunkText } from "../src/delivery/chunker";

const para = (n: number, ch = "a") => ch.repeat(n);

describe("chunkText", () => {
  test("empty input gives no chunks", () => {
    expect(chunkText("   \n\n ", { max: 100 })).toEqual([]);
  });

  test("short text stays one chunk", () => {
    expect(chunkText("hello world", { max: 100 })).toEqual(["hello world"]);
  });

  test("long paragraphs become separate chunks", () => {
    const text = `${para(300)}\n\n${para(300, "b")}`;
    expect(chunkText(text, { max: 1000 })).toEqual([para(300), para(300, "b")]);
  });

  test("short paragraph merges with the next one", () => {
    const text = `**Dünya**\n\n${para(400)}\n\n${para(400, "b")}`;
    expect(chunkText(text, { max: 1000 })).toEqual([`**Dünya**\n\n${para(400)}`, para(400, "b")]);
  });

  test("oversized paragraph is split under max", () => {
    const text = "Bu bir cümle. ".repeat(200).trim();
    const chunks = chunkText(text, { max: 300 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(300);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
  });

  test("hard-splits a single huge word", () => {
    expect(chunkText(para(250), { max: 100 })).toEqual([para(100), para(100), para(50)]);
  });

  test("keeps fenced code with blank lines together", () => {
    const code = "```\nline1\n\nline2\n```";
    expect(chunkText(`${para(300)}\n\n${code}`, { max: 1000 })).toEqual([para(300), code]);
  });

  test("normalizes CRLF", () => {
    expect(chunkText(`${para(300)}\r\n\r\n${para(300, "b")}`, { max: 1000 })).toHaveLength(2);
  });
});
