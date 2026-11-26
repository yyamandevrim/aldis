# Aldis

A private Telegram bot that keeps you connected to the world when all you have is a text chat, like messaging-only Wi-Fi on a plane. Ask what happened, it searches the web, reads the pages, and answers in short messages, one paragraph at a time.

The name comes from the **Aldis lamp**, the signal lamp control towers use to flash Morse messages to an aircraft whose radio has gone quiet.

## How it works

```
Telegram ──► Aldis (Bun, ~60 MB) ──► codex exec (your ChatGPT plan) ──► Exa search / page fetch
```

- **No LLM API key.** Each message runs one short-lived `codex exec` process, logged in with your ChatGPT subscription.
- **Exa for the web.** It uses Exa's hosted MCP server (`web_search_exa`, `web_fetch_exa`), so nothing extra runs on the box. Without a key it uses Exa's keyless free tier.
- **Built for weak links.** Answers are split into paragraph-sized messages with a typing indicator in between. Link previews are off. Progress ("🔎 Searching…") is one message that gets edited and then deleted.
- **Small footprint.** Peak RAM is about 200 MB (bot plus one Codex process). Disk use is one small SQLite file, and Codex session logs are pruned after 7 days.
- **Locked down.** Only your Telegram user id gets answers. Codex runs with its shell disabled and a read-only sandbox, and gets none of the bot's secrets.

## Commands

| Command | What it does |
| --- | --- |
| *(any text)* | Ask anything. The conversation continues until `/new` or 6 h of silence. |
| `/brief [topic]` | Briefing of the last 24 hours (default topics: `BRIEF_TOPICS`) |
| `/new` | Start a fresh conversation |
| `/status` | Uptime, session age, last turn |

## Setup (Ubuntu, 2 GB RAM is fine)

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Get your numeric user id, for example from [@userinfobot](https://t.me/userinfobot).
3. Optional: get an Exa API key at [dashboard.exa.ai](https://dashboard.exa.ai) for higher limits.
4. On the server:
   ```sh
   git clone <this repo> aldis && cd aldis
   sudo ./deploy/setup.sh          # installs bun, codex, the service user and the systemd unit
   sudo nano /etc/aldis/aldis.env  # TELEGRAM_BOT_TOKEN, ALLOWED_USER_ID, EXA_API_KEY
   sudo -u aldis env HOME=/var/lib/aldis CODEX_HOME=/var/lib/aldis/codex codex login --device-auth
   sudo systemctl enable --now aldis
   journalctl -u aldis -f
   ```
   Device-code login may need to be enabled first in ChatGPT's security settings.
5. Optional: set the bot avatar with BotFather `/setuserpic`.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | required | From BotFather |
| `ALLOWED_USER_ID` | required | The only user the bot answers |
| `EXA_API_KEY` | empty | Empty means Exa's keyless free tier |
| `DATA_DIR` | `./data` | SQLite file + Codex home + empty work dir |
| `CODEX_BIN` | `codex` | |
| `CODEX_HOME` | `$DATA_DIR/codex` | Kept separate from any other Codex use |
| `CODEX_MODEL` | Codex default | |
| `TURN_TIMEOUT_SEC` | `180` | |
| `IDLE_RESET_HOURS` | `6` | |
| `SESSION_RETENTION_DAYS` | `7` | |
| `BRIEF_TOPICS` | `world,turkey,tech,markets` | |
| `CHUNK_MAX` | `1200` | Max characters per message |
| `CHUNK_DELAY_MS` | `900` | Pause between messages |
| `TZ_NAME` | `Europe/Istanbul` | Time zone the model is told to use |
| `LOG_LEVEL` | `info` | |

## Development

```sh
bun install
cp .env.example .env                         # fill in token + your user id
CODEX_HOME=./data/codex codex login          # one time
bun run dev
bun test && bun run typecheck
```

```
src/
  index.ts            wiring
  config.ts           env + APP_NAME
  bot/                grammy setup, auth guard, commands, turn orchestration, copy
  brain/              Brain interface, codex process runner, args, JSONL parser, prompts
  delivery/           chunker, markdown → Telegram HTML, sender, status message, typing
  store/              bun:sqlite chat → session mapping
  maintenance/        old Codex session pruning
deploy/               systemd unit + setup script
```

Adding another backend (for example the Claude Code CLI) means writing one new `Brain` implementation in `src/brain/`.

## Troubleshooting

- **"kota dolmuş" (quota used up):** your ChatGPT plan's Codex limit was hit. Wait for it to reset.
- **"yeniden login gerekiyor" (login needed again):** run the `codex login --device-auth` command from the setup again.
- **Sandbox errors on Ubuntu 24.04:** Codex's Linux sandbox uses bubblewrap, and AppArmor can block unprivileged user namespaces. Aldis disables the shell tool, so the sandbox should rarely matter. If you do see `bwrap` errors in the journal, see the Codex docs on Linux sandboxing.
