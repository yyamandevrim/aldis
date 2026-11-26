import type { Bot } from "grammy";
import { buildBriefRequest } from "../brain/prompts";
import { APP_NAME, type Config } from "../config";
import type { SessionStore } from "../store/sessions";
import type { Conversation } from "./conversation";
import { texts } from "./texts";

export interface CommandDeps {
  conversation: Conversation;
  sessions: SessionStore;
  config: Pick<Config, "briefTopics">;
  startedAt: Date;
}

export const BOT_COMMANDS = [
  { command: "brief", description: "Son 24 saatin özeti (/brief konu)" },
  { command: "new", description: "Yeni sohbet" },
  { command: "status", description: "Durum" },
];

const minutesSince = (t: number) => Math.round((Date.now() - t) / 60_000);

export function registerCommands(bot: Bot, deps: CommandDeps): void {
  bot.command("start", (ctx) => ctx.reply(texts.start(APP_NAME)));

  bot.command("new", async (ctx) => {
    deps.sessions.clear(ctx.chat.id);
    await ctx.reply(texts.newDone);
  });

  // Not awaited: grammy handles updates sequentially and a turn can take minutes.
  bot.command("brief", (ctx) => {
    const topic = ctx.match.trim();
    const topics = topic ? [topic] : deps.config.briefTopics;
    void deps.conversation.runTurn(ctx.chat.id, buildBriefRequest(topics), { fresh: true });
  });

  bot.command("status", (ctx) => {
    const session = deps.sessions.get(ctx.chat.id);
    return ctx.reply(
      texts.status({
        sessionAgeMin: session ? minutesSince(session.updatedAt) : null,
        lastTurn: deps.conversation.lastTurn,
        uptimeMin: minutesSince(deps.startedAt.getTime()),
      }),
    );
  });
}
