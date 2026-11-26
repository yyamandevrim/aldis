# Aldis — Design Spec

Date: 2026-11-26
Status: approved. Name: **Aldis** (after the Aldis lamp — the signal lamp control towers use to send Morse light signals to aircraft whose radio is out). Logo TBD; name lives in `APP_NAME`.

## Purpose

A personal Telegram chat bot that keeps its single owner connected to the world when only
text messaging is available (in-flight "messaging only" Wi-Fi, poor connectivity). The owner
asks what is happening (news, a topic, a web page) and the bot searches the web, reads pages,
and replies in short, sequential Telegram messages.

## Constraints

| Constraint | Decision |
| --- | --- |
| 2 GB RAM Ubuntu host | Bun bot (~60 MB) + one short-lived `codex` process at a time (~140 MB peak, measured). No headless browser. |
| Subscription LLM, no API key | `codex exec` (Codex CLI, Rust) logged in with the owner's ChatGPT plan via `codex login --device-auth`. |
| Single user, no resale | Hard allowlist on one Telegram user id. Everyone else is ignored silently. |
| Web search + page reading | Exa hosted MCP (`https://mcp.exa.ai/mcp`), tools `web_search_exa` and `web_fetch_exa`. No local MCP process. |
| Cheap | Exa free tier / pay-as-you-go (~$5 per 1k searches). LLM covered by subscription. |
| Low storage | One small SQLite file; Codex session files pruned after 7 days. |
| Text-only friendly | Replies split into paragraph-sized messages; link previews disabled. |

## Spike findings (verified on codex-cli 0.172.0)

- `codex exec --json` prints JSONL events:
  - `{"type":"thread.started","thread_id":"<uuid>"}` — session id for later `codex exec resume <id>`.
  - `{"type":"item.started"|"item.completed","item":{"type":"mcp_tool_call","server":"exa","tool":"web_search_exa","arguments":{...},"status":...}}`
  - `{"type":"item.completed","item":{"type":"agent_message","text":"..."}}` — may occur several times; earlier ones are preambles ("I'll check…"), the **last** one is the answer.
  - `{"type":"item.completed","item":{"type":"error","message":"..."}}` — non-fatal warnings.
  - `{"type":"turn.completed","usage":{...}}` — end of turn.
- Prompt can be passed on stdin with `-`.
- `--disable shell_tool --disable unified_exec` removes shell execution (verified: model reports no shell tool).
- Codex prefers its built-in `web_search` over Exa unless `-c web_search="disabled"` is passed (verified end-to-end).
- `--ignore-user-config` + `-c 'mcp_servers.exa.url="..."'` works; Exa hosted MCP works even without a key (free tier, rate limited). With a key: `https://mcp.exa.ai/mcp?exaApiKey=<key>`.
- Peak RSS of a simple run: ~140 MB (macOS measurement).

## Architecture

```
Telegram (long polling)
   │
   ▼
bot.ts ── authGuard (ALLOWED_USER_ID)
   │
   ├─ commands.ts  (/start /new /brief /status)
   └─ onMessage.ts (text) ── per-chat lock ──┐
                                              ▼
                               Brain interface (brain/types.ts)
                                              │
                               CodexBrain (brain/codex.ts)
                                 spawn `codex exec [resume <id>] --json -`
                                 parse JSONL (brain/codexEvents.ts)
                                              │ events: tool_start, message, done, error
                                              ▼
                               delivery: status message (edited), chunker → format → sender
                                              │
                               store/sessions.ts (bun:sqlite: chat_id → thread_id, last_used)
```

### Units

| File | Responsibility | Depends on |
| --- | --- | --- |
| `src/index.ts` | Wire config, store, brain, bot; start polling; schedule prune. | all |
| `src/config.ts` | Parse/validate env; export `APP_NAME` constant. | — |
| `src/bot/bot.ts` | Create grammy `Bot`, install auth guard, register handlers. | grammy, config |
| `src/bot/authGuard.ts` | Middleware: pass only `ALLOWED_USER_ID`. | — |
| `src/bot/commands.ts` | `/start`, `/new`, `/brief [topic]`, `/status`. | brain, store, delivery |
| `src/bot/onMessage.ts` | Text messages → `runTurn`. | conversation |
| `src/bot/conversation.ts` | `runTurn(chat, prompt)`: lock, session lookup/idle reset, call brain, drive status + delivery, save session. | brain, store, delivery |
| `src/bot/chatLock.ts` | One in-flight turn per chat; second request gets "still working". | — |
| `src/brain/types.ts` | `Brain.run({prompt, sessionId?, signal}) → AsyncIterable<BrainEvent>`; `BrainEvent` union. | — |
| `src/brain/codex.ts` | Build args, spawn with sanitized env, write stdin, stream stdout lines, timeout/kill. | codexEvents |
| `src/brain/codexArgs.ts` | Pure: build argv for new/resume runs. | config |
| `src/brain/codexEvents.ts` | Pure: JSONL line → `BrainEvent | null`. | — |
| `src/brain/prompts.ts` | Persona/instructions preamble, brief prompt builder. | config |
| `src/delivery/chunker.ts` | Pure: split text into ≤ `CHUNK_MAX` pieces on paragraph → line → sentence → hard boundaries; never split inside code fences. | — |
| `src/delivery/format.ts` | Pure: light Markdown → Telegram HTML (bold, italic, code, pre, links), escape the rest. | — |
| `src/delivery/sender.ts` | Send chunks sequentially with `typing` action and delay; HTML first, plain-text fallback on parse error; link previews off. | grammy |
| `src/delivery/status.ts` | One status message per turn, edited on tool events ("🔎 searching: …", "📄 reading: …"), deleted at the end. Throttled edits. | grammy |
| `src/store/db.ts` | Open `bun:sqlite`, migrations. | bun:sqlite |
| `src/store/sessions.ts` | `get(chatId)`, `set(chatId, threadId)`, `clear(chatId)`, `touch`. | db |
| `src/maintenance/prune.ts` | Delete Codex session files older than `SESSION_RETENTION_DAYS` under `$CODEX_HOME/sessions`. | fs |
| `src/log.ts` | Minimal leveled logger to stdout (journald). | — |

## Behavior

### Turn flow
1. Auth guard drops non-owner updates.
2. Chat lock: if a turn is running, reply "hâlâ çalışıyorum…" and stop.
3. Session: if stored thread is older than `IDLE_RESET_HOURS` (default 6), drop it.
4. Build prompt: persona preamble (first turn only) + user text. Persona: reply in the user's
   language, concise, news-desk tone, short paragraphs, cite sources as links, always include
   dates for news, use Exa tools for anything time-sensitive, today's date injected.
5. Run brain. On `tool_start` update status message. Keep last `message` text.
6. On `done`: save `thread_id`, delete status, chunk + format + send final message.
7. On error/timeout (`TURN_TIMEOUT_SEC`, default 180): kill process, send short error
   message, keep session unless the error indicates an invalid session (then clear).

### Commands
- `/start` — short intro + commands.
- `/new` — clear session for this chat.
- `/brief [topic]` — "What happened in the last 24 hours?" over `BRIEF_TOPICS`
  (env, comma separated, default `world,turkey,tech,markets`) or the given topic. Runs in a
  fresh session (doesn't pollute chat), stored as the chat's current session so follow-ups work.
- `/status` — session age, last turn duration, uptime.

### Delivery
- `CHUNK_MAX` default 1200 chars (readable bubbles; Telegram hard limit 4096).
- `CHUNK_DELAY_MS` default 900 between chunks, `sendChatAction('typing')` before each.
- `link_preview_options: { is_disabled: true }`.

### Codex invocation
```
codex exec [resume <thread_id>] --json --skip-git-repo-check --ignore-user-config
  -s read-only --disable shell_tool --disable unified_exec --disable apps --disable plugins
  --disable browser_use --disable in_app_browser --disable computer_use --disable view_image
  -c 'web_search="disabled"' -c 'mcp_servers.exa.url="https://mcp.exa.ai/mcp?exaApiKey=<key>"'
  [-m <CODEX_MODEL>] -
```
- cwd: empty work dir (`DATA_DIR/work`).
- Child env is sanitized: only `PATH`, `HOME`, `CODEX_HOME`, `LANG`. Telegram token never
  reaches the child.
- `CODEX_HOME` defaults to `DATA_DIR/codex` (isolated from any other Codex usage).

## Config (env)

| Var | Required | Default |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | yes | — |
| `ALLOWED_USER_ID` | yes | — |
| `EXA_API_KEY` | no | empty → keyless free tier |
| `DATA_DIR` | no | `./data` |
| `CODEX_BIN` | no | `codex` |
| `CODEX_HOME` | no | `$DATA_DIR/codex` |
| `CODEX_MODEL` | no | Codex default |
| `TURN_TIMEOUT_SEC` | no | 180 |
| `IDLE_RESET_HOURS` | no | 6 |
| `SESSION_RETENTION_DAYS` | no | 7 |
| `BRIEF_TOPICS` | no | `world,turkey,tech,markets` |
| `CHUNK_MAX` | no | 1200 |
| `CHUNK_DELAY_MS` | no | 900 |
| `TZ_NAME` | no | `Europe/Istanbul` |

## Security

- Owner allowlist; no webhook / no open port (long polling).
- Codex has no shell, read-only sandbox, empty cwd, sanitized env.
- Deploy runs as dedicated `aldis` system user; `.env` root-owned, loaded via systemd
  `EnvironmentFile`. Residual risk: prompt injection from web pages could make the model read
  files readable by the `aldis` user (e.g. Codex `auth.json`); acceptable for a personal bot.

## Deploy

- `deploy/setup.sh`: install bun + codex, create user + dirs, copy unit, prompt for
  `codex login --device-auth` as the service user.
- `deploy/aldis.service`: systemd, `MemoryMax=600M`, `Restart=on-failure`.
- `.env.example` documented.

## Testing

`bun test`, unit tests for pure modules: `chunker`, `format`, `codexEvents`, `codexArgs`,
`authGuard`, `chatLock`, `sessions` (in-memory sqlite), `prune` (temp dir). `CodexBrain`
tested against a fake `codex` script that prints recorded JSONL.

## Out of scope (YAGNI)

Scheduled/automatic briefings, voice/images, multiple users, webhook mode, web UI, local
page fetching, a second LLM adapter (interface is ready for it).

## Later

Gemini-generated logo; then new GitHub repo + push (last step).
