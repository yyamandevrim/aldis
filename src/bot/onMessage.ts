import type { Bot } from "grammy";
import type { Conversation } from "./conversation";

export function registerMessageHandler(bot: Bot, conversation: Conversation): void {
  bot.on("message:text", (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return;
    // Not awaited so the next update (e.g. /new) is not blocked by a long turn.
    void conversation.runTurn(ctx.chat.id, text);
  });
}
