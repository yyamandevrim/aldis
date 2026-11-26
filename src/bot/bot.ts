import { autoRetry } from "@grammyjs/auto-retry";
import type { Bot } from "grammy";
import { log } from "../log";
import { authGuard } from "./authGuard";
import { type CommandDeps, registerCommands } from "./commands";
import { registerMessageHandler } from "./onMessage";

export interface BotDeps extends CommandDeps {
  allowedUserId: number;
}

export function setupBot(bot: Bot, deps: BotDeps): void {
  bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 30 }));
  bot.use(authGuard(deps.allowedUserId));
  registerCommands(bot, deps);
  registerMessageHandler(bot, deps.conversation);
  bot.catch((err) => log.error("bot error", err.error));
}
