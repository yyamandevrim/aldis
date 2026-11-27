#!/usr/bin/env bash
# Installs or updates Aldis on Ubuntu. Run from the repo root: sudo ./deploy/setup.sh
set -euo pipefail

APP_DIR=/opt/aldis
DATA_DIR=/var/lib/aldis
ENV_FILE=/etc/aldis/aldis.env

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }
[[ -f package.json && -d src ]] || { echo "Run from the repo root." >&2; exit 1; }

apt-get update -qq
apt-get install -y -qq curl unzip ca-certificates rsync bubblewrap

if ! command -v bun >/dev/null; then
  curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash
fi

# Codex needs two binaries side by side: `codex` and `codex-code-mode-host`
# (tool calls, including Exa MCP, run through the host; without it every search fails).
case "$(uname -m)" in
  x86_64) target=x86_64-unknown-linux-musl ;;
  aarch64 | arm64) target=aarch64-unknown-linux-musl ;;
  *) echo "Unsupported arch $(uname -m)" >&2; exit 1 ;;
esac
codex_release_url() {
  local bin=$1 version=$2
  if [[ -n $version ]]; then
    echo "https://github.com/openai/codex/releases/download/rust-v${version}/${bin}-${target}.tar.gz"
  else
    echo "https://github.com/openai/codex/releases/latest/download/${bin}-${target}.tar.gz"
  fi
}
install_codex_bin() {
  local bin=$1 version=$2 tmp
  tmp=$(mktemp -d)
  curl -fsSL "$(codex_release_url "$bin" "$version")" | tar -xz -C "$tmp"
  install -m 755 "$tmp/${bin}-${target}" "/usr/local/bin/${bin}"
  rm -rf "$tmp"
}
if [[ ! -x /usr/local/bin/codex ]]; then
  install_codex_bin codex ""
fi
# Pin the host to the installed codex version so the pair always matches.
codex_version=$(/usr/local/bin/codex --version | awk '{print $2}')
if [[ ! -x /usr/local/bin/codex-code-mode-host ]]; then
  install_codex_bin codex-code-mode-host "$codex_version"
fi

id aldis >/dev/null 2>&1 || useradd --system --home-dir "$DATA_DIR" --create-home --shell /usr/sbin/nologin aldis
install -d -o aldis -g aldis -m 700 "$DATA_DIR" "$DATA_DIR/codex"

install -d "$APP_DIR"
rsync -a --delete --exclude .git --exclude data --exclude node_modules --exclude .env --exclude 'assets/logo/concepts' ./ "$APP_DIR/"
(cd "$APP_DIR" && bun install --production --frozen-lockfile)

install -d -m 755 /etc/aldis
if [[ ! -f $ENV_FILE ]]; then
  install -m 600 -o root -g root .env.example "$ENV_FILE"
  echo "Created $ENV_FILE — fill in TELEGRAM_BOT_TOKEN and ALLOWED_USER_ID."
fi

install -m 644 deploy/aldis.service /etc/systemd/system/aldis.service
systemctl daemon-reload

cat <<EOF

Done. Next steps:
  1. Edit $ENV_FILE
  2. Log Codex in with your ChatGPT plan (one time):
       sudo -u aldis env HOME=$DATA_DIR CODEX_HOME=$DATA_DIR/codex codex login --device-auth
  3. sudo systemctl enable --now aldis && journalctl -u aldis -f
  Updates later: git pull && sudo ./deploy/setup.sh && sudo systemctl restart aldis
EOF
