export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/** Inline code and links are stashed first so their content is not re-formatted. */
function formatInline(text: string): string {
  const slots: string[] = [];
  const stash = (html: string) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = text.replace(/`([^`]+)`/g, (_, code: string) => stash(`<code>${escapeHtml(code)}</code>`));
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label: string, url: string) =>
    stash(`<a href="${escapeAttr(url)}">${escapeHtml(label)}</a>`),
  );
  s = escapeHtml(s);
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/__(.+?)__/g, "<b>$1</b>");
  s = s.replace(/(^|[^\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "$1<i>$2</i>");
  s = s.replace(/(^|[^\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1<i>$2</i>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => slots[Number(i)] ?? "");
}

function formatLine(line: string): string {
  const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
  if (heading) return `<b>${formatInline(heading[1] ?? "")}</b>`;
  const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
  if (bullet) return `${bullet[1] ?? ""}• ${formatInline(bullet[2] ?? "")}`;
  return formatInline(line);
}

/** Converts the light Markdown the model writes into Telegram's HTML subset. */
export function markdownToTelegramHtml(md: string): string {
  const out: string[] = [];
  let fence: string[] | null = null;
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    if (line.trimStart().startsWith("```")) {
      if (fence) {
        out.push(`<pre>${escapeHtml(fence.join("\n"))}</pre>`);
        fence = null;
      } else {
        fence = [];
      }
      continue;
    }
    if (fence) fence.push(line);
    else out.push(formatLine(line));
  }
  if (fence) out.push(`<pre>${escapeHtml(fence.join("\n"))}</pre>`);
  return out.join("\n");
}
