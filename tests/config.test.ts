import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { APP_NAME, loadConfig } from "../src/config";

const base = { TELEGRAM_BOT_TOKEN: "tok", ALLOWED_USER_ID: "42" };

describe("loadConfig", () => {
  test("applies defaults", () => {
    const c = loadConfig(base);
    expect(APP_NAME).toBe("Aldis");
    expect(c.telegramToken).toBe("tok");
    expect(c.allowedUserId).toBe(42);
    expect(c.exaApiKey).toBe("");
    expect(c.dataDir).toBe(resolve("./data"));
    expect(c.codexHome).toBe(resolve("./data/codex"));
    expect(c.codexBin).toBe("codex");
    expect(c.codexModel).toBeUndefined();
    expect(c.turnTimeoutSec).toBe(180);
    expect(c.idleResetHours).toBe(6);
    expect(c.sessionRetentionDays).toBe(7);
    expect(c.briefTopics).toEqual(["world", "turkey", "tech", "markets"]);
    expect(c.chunkMax).toBe(1200);
    expect(c.chunkDelayMs).toBe(900);
    expect(c.tzName).toBe("Europe/Istanbul");
  });

  test("reads overrides", () => {
    const c = loadConfig({
      ...base,
      DATA_DIR: "/tmp/x",
      BRIEF_TOPICS: " ai , ,space ",
      CODEX_MODEL: "gpt-5",
      CHUNK_MAX: "800",
    });
    expect(c.dataDir).toBe("/tmp/x");
    expect(c.codexHome).toBe("/tmp/x/codex");
    expect(c.briefTopics).toEqual(["ai", "space"]);
    expect(c.codexModel).toBe("gpt-5");
    expect(c.chunkMax).toBe(800);
  });

  test("throws on missing required vars", () => {
    expect(() => loadConfig({ ALLOWED_USER_ID: "1" })).toThrow("TELEGRAM_BOT_TOKEN");
    expect(() => loadConfig({ TELEGRAM_BOT_TOKEN: "t" })).toThrow("ALLOWED_USER_ID");
  });

  test("throws on bad integers", () => {
    expect(() => loadConfig({ ...base, ALLOWED_USER_ID: "abc" })).toThrow("ALLOWED_USER_ID");
    expect(() => loadConfig({ ...base, CHUNK_MAX: "-5" })).toThrow("CHUNK_MAX");
  });
});
