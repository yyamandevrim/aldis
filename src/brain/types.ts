/** Normalized events any LLM backend ("brain") emits during one turn. */
export type BrainEvent =
  | { type: "session"; sessionId: string }
  | { type: "tool_start"; tool: string; detail?: string }
  | { type: "message"; text: string }
  | { type: "warning"; message: string }
  | { type: "turn_done" }
  | { type: "error"; message: string };

export interface BrainRunOptions {
  prompt: string;
  /** Resume this backend session; omit to start a new one. */
  sessionId?: string;
  signal?: AbortSignal;
}

export interface Brain {
  run(opts: BrainRunOptions): AsyncIterable<BrainEvent>;
}
