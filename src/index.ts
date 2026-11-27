import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Bot } from "grammy";
import { setupBot } from "./bot/bot";
import { ChatLock } from "./bot/chatLock";
import { BOT_COMMANDS } from "./bot/commands";
import { Conversation } from "./bot/conversation";
import { CodexBrain } from "./brain/codex";
import { checkCodexInstall } from "./brain/codexPreflight";
import { APP_NAME, loadConfig } from "./config";
import { fromGrammy } from "./delivery/telegram";
import { log } from "./log";
import { pruneOldSessions } from "./maintenance/prune";
import { openDb } from "./store/db";
import { SessionStore } from "./store/sessions";

const DAY_MS = 86_400_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const workDir = join(config.dataDir, "work");
  await mkdir(workDir, { recursive: true });
  await mkdir(config.codexHome, { recursive: true });

  const installProblem = checkCodexInstall(config.codexBin);
  if (installProblem) log.error(installProblem);

  const sessions = new SessionStore(openDb(join(config.dataDir, "aldis.sqlite")));
  const brain = new CodexBrain({
    bin: config.codexBin,
    codexHome: config.codexHome,
    workDir,
    exaApiKey: config.exaApiKey,
    model: config.codexModel,
  });

  const bot = new Bot(config.telegramToken);
  const conversation = new Conversation({ brain, sessions, lock: new ChatLock(), tg: fromGrammy(bot.api), config });
  setupBot(bot, { conversation, sessions, config, startedAt: new Date(), allowedUserId: config.allowedUserId });

  const prune = () =>
    pruneOldSessions(join(config.codexHome, "sessions"), config.sessionRetentionDays)
      .then((n) => n > 0 && log.info(`pruned ${n} old codex session files`))
      .catch((err) => log.warn("prune failed", err));
  void prune();
  setInterval(prune, DAY_MS);

  await bot.api.setMyCommands(BOT_COMMANDS).catch((err) => log.warn("setMyCommands failed", err));
  const stop = () => bot.stop();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await bot.start({
    allowed_updates: ["message"],
    onStart: (me) => log.info(`${APP_NAME} running as @${me.username}`),
  });
}

main().catch((err) => {
  log.error("fatal", err);
  process.exit(1);
});
