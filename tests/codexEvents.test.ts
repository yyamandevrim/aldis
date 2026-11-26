import { describe, expect, test } from "bun:test";
import { parseCodexLine as p } from "../src/brain/codexEvents";

const j = (o: unknown) => JSON.stringify(o);

describe("parseCodexLine", () => {
  test("thread.started", () => {
    expect(p(j({ type: "thread.started", thread_id: "t1" }))).toEqual({ type: "session", sessionId: "t1" });
  });

  test("agent message", () => {
    expect(p(j({ type: "item.completed", item: { type: "agent_message", text: "hi" } }))).toEqual({
      type: "message",
      text: "hi",
    });
  });

  test("mcp tool start with query / url", () => {
    expect(
      p(j({ type: "item.started", item: { type: "mcp_tool_call", tool: "web_search_exa", arguments: { query: "q" } } })),
    ).toEqual({ type: "tool_start", tool: "web_search_exa", detail: "q" });
    expect(
      p(
        j({
          type: "item.started",
          item: { type: "mcp_tool_call", tool: "web_fetch_exa", arguments: { urls: ["https://a"] } },
        }),
      ),
    ).toEqual({ type: "tool_start", tool: "web_fetch_exa", detail: "https://a" });
  });

  test("built-in web search start", () => {
    expect(p(j({ type: "item.started", item: { type: "web_search", action: { type: "other" } } }))).toEqual({
      type: "tool_start",
      tool: "web_search",
    });
  });

  test("warning item", () => {
    expect(p(j({ type: "item.completed", item: { type: "error", message: "deprecated" } }))).toEqual({
      type: "warning",
      message: "deprecated",
    });
  });

  test("turn completed / failed / error", () => {
    expect(p(j({ type: "turn.completed", usage: {} }))).toEqual({ type: "turn_done" });
    expect(p(j({ type: "turn.failed", error: { message: "quota" } }))).toEqual({ type: "error", message: "quota" });
    expect(p(j({ type: "error", message: "boom" }))).toEqual({ type: "error", message: "boom" });
  });

  test("ignores noise", () => {
    expect(p("")).toBeNull();
    expect(p("not json")).toBeNull();
    expect(p("{broken")).toBeNull();
    expect(p(j({ type: "turn.started" }))).toBeNull();
    expect(p(j({ type: "item.completed", item: { type: "mcp_tool_call" } }))).toBeNull();
  });
});
