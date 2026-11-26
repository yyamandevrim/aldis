import type { MessageOptions, TelegramLike } from "../../src/delivery/telegram";

export interface Call {
  method: "sendMessage" | "editMessageText" | "deleteMessage" | "sendChatAction";
  chatId: number;
  text?: string;
  messageId?: number;
  other?: MessageOptions;
}

/** Records Telegram API calls instead of sending them. */
export class FakeTelegram implements TelegramLike {
  calls: Call[] = [];
  failHtmlOnce = false;
  private nextId = 1;

  async sendMessage(chatId: number, text: string, other?: MessageOptions) {
    if (this.failHtmlOnce && other?.parse_mode === "HTML") {
      this.failHtmlOnce = false;
      throw new Error("Bad Request: can't parse entities: unexpected end tag");
    }
    const message_id = this.nextId++;
    this.calls.push({ method: "sendMessage", chatId, text, other, messageId: message_id });
    return { message_id };
  }

  async editMessageText(chatId: number, messageId: number, text: string, other?: MessageOptions) {
    this.calls.push({ method: "editMessageText", chatId, messageId, text, other });
    return true;
  }

  async deleteMessage(chatId: number, messageId: number) {
    this.calls.push({ method: "deleteMessage", chatId, messageId });
    return true;
  }

  async sendChatAction(chatId: number) {
    this.calls.push({ method: "sendChatAction", chatId });
    return true;
  }

  sentTexts(): string[] {
    return this.calls.filter((c) => c.method === "sendMessage").map((c) => c.text ?? "");
  }
}
