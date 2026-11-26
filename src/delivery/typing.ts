import type { TelegramLike } from "./telegram";

/** Telegram's typing indicator expires after ~5s, so it is refreshed until stopped. */
export function startTyping(tg: TelegramLike, chatId: number, intervalMs = 4500): { stop(): void } {
  const tick = () => {
    tg.sendChatAction(chatId, "typing").catch(() => {});
  };
  tick();
  const handle = setInterval(tick, intervalMs);
  return { stop: () => clearInterval(handle) };
}
