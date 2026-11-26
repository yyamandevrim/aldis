import { join, resolve } from "node:path";

export const APP_NAME = "Aldis";

export interface Config {
  telegramToken: string;
  allowedUserId: number;
  exaApiKey: string;
  dataDir: string;
  codexBin: string;
  codexHome: string;
  codexModel?: string;
  turnTimeoutSec: number;
  idleResetHours: number;
  sessionRetentionDays: number;
  briefTopics: string[];
  chunkMax: number;
  chunkDelayMs: number;
  tzName: string;
}

type Env = Record<string, string | undefined>;

function str(env: Env, key: string): string | undefined {
  const v = env[key]?.trim();
  return v ? v : undefined;
}

function required(env: Env, key: string): string {
  const v = str(env, key);
  if (!v) throw new Error(`Missing required env var ${key}`);
  return v;
}

function positiveInt(env: Env, key: string, fallback: number): number {
  const raw = str(env, key);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Env var ${key} must be a positive integer, got "${raw}"`);
  }
  return n;
}

export function loadConfig(env: Env = process.env): Config {
  const telegramToken = required(env, "TELEGRAM_BOT_TOKEN");
  const allowedRaw = required(env, "ALLOWED_USER_ID");
  const allowedUserId = Number(allowedRaw);
  if (!Number.isInteger(allowedUserId)) {
    throw new Error(`Env var ALLOWED_USER_ID must be an integer, got "${allowedRaw}"`);
  }
  const dataDir = resolve(str(env, "DATA_DIR") ?? "./data");
  return {
    telegramToken,
    allowedUserId,
    exaApiKey: str(env, "EXA_API_KEY") ?? "",
    dataDir,
    codexBin: str(env, "CODEX_BIN") ?? "codex",
    codexHome: resolve(str(env, "CODEX_HOME") ?? join(dataDir, "codex")),
    codexModel: str(env, "CODEX_MODEL"),
    turnTimeoutSec: positiveInt(env, "TURN_TIMEOUT_SEC", 180),
    idleResetHours: positiveInt(env, "IDLE_RESET_HOURS", 6),
    sessionRetentionDays: positiveInt(env, "SESSION_RETENTION_DAYS", 7),
    briefTopics: (str(env, "BRIEF_TOPICS") ?? "world,turkey,tech,markets")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    chunkMax: positiveInt(env, "CHUNK_MAX", 1200),
    chunkDelayMs: positiveInt(env, "CHUNK_DELAY_MS", 900),
    tzName: str(env, "TZ_NAME") ?? "Europe/Istanbul",
  };
}
