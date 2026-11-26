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

export function buildBriefRequest(topics: string[]): string {
  return [
    `Give me a briefing of what happened in the last 24 hours for these topics: ${topics.join(", ")}.`,
    "Search each topic separately.",
    "For each topic: one **bold** title line, then 2-4 of the most important items, each one or two sentences with date and source link.",
    "Skip a topic if nothing notable happened.",
    "If something major happened outside these topics, add one final short paragraph about it.",
  ].join("\n");
}
