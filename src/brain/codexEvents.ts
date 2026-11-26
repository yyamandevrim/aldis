import type { BrainEvent } from "./types";

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null;
}

function toolDetail(args: unknown): string | undefined {
  if (!isObj(args)) return undefined;
  const v = args.query ?? args.url ?? args.urls;
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

/** Maps one `codex exec --json` JSONL line to a BrainEvent; null for anything irrelevant. */
export function parseCodexLine(line: string): BrainEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  let ev: unknown;
  try {
    ev = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isObj(ev)) return null;
  const item = isObj(ev.item) ? ev.item : undefined;
  switch (ev.type) {
    case "thread.started":
      return typeof ev.thread_id === "string" ? { type: "session", sessionId: ev.thread_id } : null;
    case "item.started":
      if (item?.type === "mcp_tool_call" && typeof item.tool === "string") {
        return { type: "tool_start", tool: item.tool, detail: toolDetail(item.arguments) };
      }
      if (item?.type === "web_search") return { type: "tool_start", tool: "web_search" };
      return null;
    case "item.completed":
      if (item?.type === "agent_message" && typeof item.text === "string") return { type: "message", text: item.text };
      if (item?.type === "error" && typeof item.message === "string") return { type: "warning", message: item.message };
      return null;
    case "turn.completed":
      return { type: "turn_done" };
    case "turn.failed": {
      const err = isObj(ev.error) ? ev.error : {};
      return { type: "error", message: typeof err.message === "string" ? err.message : "turn failed" };
    }
    case "error":
      return { type: "error", message: typeof ev.message === "string" ? ev.message : "unknown error" };
    default:
      return null;
  }
}
