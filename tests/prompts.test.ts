import { describe, expect, test } from "bun:test";
import { describeError } from "../src/bot/texts";
import { buildBriefRequest, buildTurnPrompt, formatNow } from "../src/brain/prompts";

const ctx = { now: new Date("2026-11-26T10:00:00Z"), tzName: "Europe/Istanbul", appName: "Aldis" };

describe("prompts", () => {
  test("formatNow uses timezone", () => {
    const s = formatNow(ctx.now, ctx.tzName);
    expect(s).toContain("26 November 2026");
    expect(s).toContain("13:00");
    expect(s).toContain("Europe/Istanbul");
  });

  test("new session includes persona", () => {
    const p = buildTurnPrompt("Neler oldu?", ctx, true);
    expect(p).toContain("You are Aldis");
    expect(p).toContain("web_search_exa");
    expect(p).toContain("13:00");
    expect(p.endsWith("Neler oldu?")).toBe(true);
  });

  test("resumed session has only time header + text", () => {
    const p = buildTurnPrompt("Peki ya?", ctx, false);
    expect(p).not.toContain("You are Aldis");
    expect(p).toContain("13:00");
    expect(p.endsWith("Peki ya?")).toBe(true);
  });

  test("brief request lists topics and is written in Turkish", () => {
    // The persona replies in the user's language, so the request itself must be Turkish.
    const r = buildBriefRequest(["world", "tech"]);
    expect(r).toContain("world, tech");
    expect(r).toContain("son 24 saat");
    expect(r).not.toContain("Give me");
  });

  test("describeError maps quota errors", () => {
    expect(describeError("You've hit your usage limit")).toContain("kota");
    expect(describeError("x".repeat(500)).length).toBeLessThan(300);
  });
});
