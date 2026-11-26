import { log } from "../log";
import { NO_PREVIEW, type TelegramLike } from "./telegram";

export interface StatusOptions {
  minIntervalMs?: number;
  now?: () => number;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function describeTool(tool: string, detail?: string): string {
  const suffix = detail ? `: ${truncate(detail, 70)}` : "";
  if (tool.includes("search")) return `🔎 Arıyorum${suffix}`;
  if (tool.includes("fetch") || tool.includes("crawl")) return `📄 Okuyorum${suffix}`;
  return `🛠 ${tool}${suffix}`;
}

/** A single progress message per turn: created once, edited (throttled), deleted at the end. */
export class StatusMessage {
  private messageId: number | null = null;
  private lastText = "";
  private lastEditAt = 0;
  private readonly minIntervalMs: number;
  private readonly now: () => number;

  constructor(
    private readonly tg: TelegramLike,
    private readonly chatId: number,
    opts: StatusOptions = {},
  ) {
    this.minIntervalMs = opts.minIntervalMs ?? 1500;
    this.now = opts.now ?? Date.now;
  }

  async show(text: string): Promise<void> {
    if (text === this.lastText) return;
    const now = this.now();
    try {
      if (this.messageId === null) {
        const msg = await this.tg.sendMessage(this.chatId, text, NO_PREVIEW);
        this.messageId = msg.message_id;
      } else {
        if (now - this.lastEditAt < this.minIntervalMs) return;
        await this.tg.editMessageText(this.chatId, this.messageId, text, NO_PREVIEW);
      }
      this.lastText = text;
      this.lastEditAt = now;
    } catch (err) {
      log.warn("status update failed", err);
    }
  }

  async clear(): Promise<void> {
    if (this.messageId === null) return;
    const id = this.messageId;
    this.messageId = null;
    await this.tg.deleteMessage(this.chatId, id).catch((err) => log.warn("status delete failed", err));
  }
}
