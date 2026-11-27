import { buildTurnPrompt } from "../brain/prompts";
import type { Brain } from "../brain/types";
import { APP_NAME, type Config } from "../config";
import { chunkText } from "../delivery/chunker";
import { sendChunks, sendFormatted } from "../delivery/sender";
import { StatusMessage, describeTool } from "../delivery/status";
import type { TelegramLike } from "../delivery/telegram";
import { startTyping } from "../delivery/typing";
import { log } from "../log";
import type { SessionRecord, SessionStore } from "../store/sessions";
import type { ChatLock } from "./chatLock";
import { describeError, texts } from "./texts";

export interface ConversationDeps {
  brain: Brain;
  sessions: SessionStore;
  lock: ChatLock;
  tg: TelegramLike;
  config: Pick<Config, "turnTimeoutSec" | "idleResetHours" | "chunkMax" | "chunkDelayMs" | "tzName">;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface TurnOptions {
  /** Start a new brain session even if a recent one exists (used by /brief). */
  fresh?: boolean;
}

interface TurnOutcome {
  sessionId?: string;
  answer: string;
  error: string | null;
}

const BAD_SESSION = /(session|thread|rollout).*(not found|no such|invalid|missing)/i;

/** One user message in, one (chunked) answer out. Never throws. */
export class Conversation {
  lastTurn: { at: Date; durationMs: number; ok: boolean } | null = null;
  private readonly now: () => Date;

  constructor(private readonly deps: ConversationDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async runTurn(chatId: number, userText: string, opts: TurnOptions = {}): Promise<void> {
    const { tg, lock } = this.deps;
    const release = lock.tryAcquire(chatId);
    if (!release) {
      await sendFormatted(tg, chatId, texts.busy).catch((err) => log.warn("busy reply failed", err));
      return;
    }
    const startedAt = this.now();
    let ok = false;
    try {
      ok = await this.execute(chatId, userText, opts, startedAt);
    } catch (err) {
      log.error("turn crashed", err);
      await sendFormatted(tg, chatId, texts.crash).catch(() => {});
    } finally {
      release();
      this.lastTurn = { at: startedAt, durationMs: this.now().getTime() - startedAt.getTime(), ok };
    }
  }

  private activeSession(chatId: number, at: Date): SessionRecord | null {
    const rec = this.deps.sessions.get(chatId);
    if (!rec) return null;
    if (at.getTime() - rec.updatedAt > this.deps.config.idleResetHours * 3_600_000) {
      this.deps.sessions.clear(chatId);
      return null;
    }
    return rec;
  }

  private async execute(chatId: number, userText: string, opts: TurnOptions, startedAt: Date): Promise<boolean> {
    const { tg, sessions, config } = this.deps;
    const existing = opts.fresh ? null : this.activeSession(chatId, startedAt);
    const prompt = buildTurnPrompt(userText, { now: startedAt, tzName: config.tzName, appName: APP_NAME }, !existing);

    const status = new StatusMessage(tg, chatId);
    const typing = startTyping(tg, chatId);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), config.turnTimeoutSec * 1000);
    let outcome: TurnOutcome;
    try {
      outcome = await this.consume(prompt, existing?.sessionId, abort.signal, status);
    } finally {
      clearTimeout(timer);
      typing.stop();
      await status.clear();
    }

    if (outcome.sessionId) sessions.set(chatId, outcome.sessionId, this.now().getTime());
    if (abort.signal.aborted) {
      await sendFormatted(tg, chatId, texts.timeout);
      return false;
    }
    if (outcome.error && !outcome.answer.trim()) {
      if (existing && BAD_SESSION.test(outcome.error)) sessions.clear(chatId);
      log.warn("brain error", outcome.error);
      await sendFormatted(tg, chatId, describeError(outcome.error));
      return false;
    }
    if (!outcome.answer.trim()) {
      await sendFormatted(tg, chatId, texts.empty);
      return false;
    }
    const chunks = chunkText(outcome.answer, { max: config.chunkMax });
    await sendChunks(tg, chatId, chunks, { delayMs: config.chunkDelayMs, sleep: this.deps.sleep });
    return true;
  }

  /** Drains brain events; the last agent message is the answer, earlier ones are preambles. */
  private async consume(
    prompt: string,
    sessionId: string | undefined,
    signal: AbortSignal,
    status: StatusMessage,
  ): Promise<TurnOutcome> {
    const outcome: TurnOutcome = { sessionId, answer: "", error: null };
    for await (const ev of this.deps.brain.run({ prompt, sessionId, signal })) {
      switch (ev.type) {
        case "session":
          outcome.sessionId = ev.sessionId;
          break;
        case "tool_start":
          await status.show(describeTool(ev.tool, ev.detail));
          break;
        case "message":
          outcome.answer = ev.text;
          break;
        case "warning":
          // e.g. "Code Mode is unavailable because failed to spawn code-mode host…"
          if (/unavailable|failed to spawn|not found/i.test(ev.message)) log.error("codex warning", ev.message);
          else log.debug("codex warning", ev.message);
          break;
        case "error":
          outcome.error = ev.message;
          break;
        case "turn_done":
          break;
      }
    }
    return outcome;
  }
}
