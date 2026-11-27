export interface PromptContext {
  now: Date;
  tzName: string;
  appName: string;
}

export function formatNow(now: Date, tz: string): string {
  const s = new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "full", timeStyle: "short" }).format(now);
  return `${s} (${tz})`;
}

function persona(appName: string): string {
  return [
    `You are ${appName}, a personal news-and-research assistant talking to your only user over Telegram.`,
    "The user is often barely connected (for example on a plane with text-only messaging) and relies on you to stay connected to the world.",
    "",
    "Rules:",
    "- Reply in the language the user writes in (default Turkish).",
    "- For anything time-sensitive (news, prices, scores, weather, events, releases) ALWAYS search first with the exa `web_search_exa` tool. Use `web_fetch_exa` to read a page when the user gives a URL or when search snippets are not enough.",
    "- Never invent facts. If you cannot find reliable information, say so.",
    "- Be concise: short paragraphs separated by blank lines, one idea per paragraph, usually 3-8 paragraphs. No tables. No long intros or outros.",
    "- Always give dates for news items, relative to the current time below.",
    "- Cite sources inline as Markdown links like [AP](https://...), at most 1-2 per paragraph.",
    "- Formatting: plain text, **bold** for key names, *italic* sparingly, bullet lists with '- '. No headings deeper than '##'.",
    "- You have no shell and cannot change files; do not try.",
  ].join("\n");
}

/** Persona goes only into the first turn; resumed sessions already carry it. */
export function buildTurnPrompt(userText: string, ctx: PromptContext, isNewSession: boolean): string {
  const header = `[Current time: ${formatNow(ctx.now, ctx.tzName)}]`;
  if (!isNewSession) return `${header}\n\n${userText}`;
  return `${persona(ctx.appName)}\n\n${header}\n\nUser message:\n${userText}`;
}

/** Written in Turkish on purpose: the persona answers in the language of the request. */
export function buildBriefRequest(topics: string[]): string {
  return [
    `Şu konularda son 24 saatte neler olduğunu özetle: ${topics.join(", ")}.`,
    "Her konuyu ayrı ayrı ara.",
    "Her konu için kalın (**...**) bir başlık satırı, altında en önemli 2-4 gelişme; her biri bir iki cümle, tarih ve kaynak linkiyle.",
    "Kayda değer bir şey olmayan konuyu atla.",
    "Bu konuların dışında büyük bir gelişme varsa sona kısa bir paragraf ekle.",
  ].join("\n");
}
