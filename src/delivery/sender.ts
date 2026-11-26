import { log } from "../log";
import { markdownToTelegramHtml } from "./format";
import { NO_PREVIEW, type TelegramLike } from "./telegram";

export interface SendChunksOptions {
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isParseError(err: unknown): boolean {
  return /parse entities|start tag|end tag/i.test(err instanceof Error ? err.message : String(err));
}

/** Sends one message as HTML; falls back to the raw text if Telegram rejects the markup. */
export async function sendFormatted(tg: TelegramLike, chatId: number, markdown: string): Promise<void> {
  try {
    await tg.sendMessage(chatId, markdownToTelegramHtml(markdown), { ...NO_PREVIEW, parse_mode: "HTML" });
  } catch (err) {
    if (!isParseError(err)) throw err;
    log.warn("HTML rejected by Telegram, sending plain text", err);
    await tg.sendMessage(chatId, markdown, NO_PREVIEW);
  }
}

/** Sends chunks one by one with a typing indicator and a short pause in between. */
export async function sendChunks(
  tg: TelegramLike,
  chatId: number,
  chunks: string[],
  { delayMs, sleep = defaultSleep }: SendChunksOptions,
): Promise<void> {
  for (const [i, chunk] of chunks.entries()) {
    if (i > 0) {
      await tg.sendChatAction(chatId, "typing").catch(() => {});
      await sleep(delayMs);
    }
    await sendFormatted(tg, chatId, chunk);
  }
}
