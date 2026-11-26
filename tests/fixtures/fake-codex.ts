#!/usr/bin/env bun
// Stand-in for `codex exec --json`: reads the prompt from stdin and prints recorded-style JSONL.
const prompt = await new Response(Bun.stdin.stream()).text();
const args = process.argv.slice(2);
const out = (o: unknown) => console.log(JSON.stringify(o));

if (prompt.includes("FAIL")) {
  console.error("fatal: something broke");
  process.exit(2);
}
if (prompt.includes("HANG")) await Bun.sleep(30_000);

const resumeAt = args.indexOf("resume");
const thread = resumeAt >= 0 ? args[resumeAt + 1] : "thread-new-123";
out({ type: "thread.started", thread_id: thread });
out({ type: "turn.started" });
out({ type: "item.completed", item: { id: "item_0", type: "agent_message", text: "Bakıyorum." } });
out({
  type: "item.started",
  item: { id: "item_1", type: "mcp_tool_call", tool: "web_search_exa", arguments: { query: "news" } },
});
const token = process.env.TELEGRAM_BOT_TOKEN ?? "none";
out({
  type: "item.completed",
  item: {
    id: "item_2",
    type: "agent_message",
    text: `echo:${prompt.trim()}|home:${process.env.CODEX_HOME}|token:${token}`,
  },
});
if (!prompt.includes("NODONE")) out({ type: "turn.completed", usage: {} });

export {};
