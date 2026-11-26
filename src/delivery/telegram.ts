import type { Api } from "grammy";

export interface MessageOptions {
  parse_mode?: "HTML";
  link_preview_options?: { is_disabled: boolean };
}

/** The slice of the Telegram API the delivery layer uses; easy to fake in tests. */
export interface TelegramLike {
  sendMessage(chatId: number, text: string, other?: MessageOptions): Promise<{ message_id: number }>;
  editMessageText(chatId: number, messageId: number, text: string, other?: MessageOptions): Promise<unknown>;
  deleteMessage(chatId: number, messageId: number): Promise<unknown>;
  sendChatAction(chatId: number, action: "typing"): Promise<unknown>;
}

/** Link previews cost bandwidth on in-flight Wi-Fi; always off. */
export const NO_PREVIEW: MessageOptions = { link_preview_options: { is_disabled: true } };

export function fromGrammy(api: Api): TelegramLike {
  return {
    sendMessage: (chatId, text, other) => api.sendMessage(chatId, text, other),
    editMessageText: (chatId, messageId, text, other) => api.editMessageText(chatId, messageId, text, other),
    deleteMessage: (chatId, messageId) => api.deleteMessage(chatId, messageId),
    sendChatAction: (chatId, action) => api.sendChatAction(chatId, action),
  };
}
