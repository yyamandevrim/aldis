import type { Database } from "bun:sqlite";

export interface SessionRecord {
  chatId: number;
  sessionId: string;
  /** Epoch ms of the last turn in this session. */
  updatedAt: number;
}

interface Row {
  chat_id: number;
  session_id: string;
  updated_at: number;
}

/** Maps a Telegram chat to the brain session (Codex thread) it continues. */
export class SessionStore {
  constructor(private readonly db: Database) {}

  get(chatId: number): SessionRecord | null {
    const row = this.db
      .query("SELECT chat_id, session_id, updated_at FROM sessions WHERE chat_id = ?")
      .get(chatId) as Row | null;
    return row ? { chatId: row.chat_id, sessionId: row.session_id, updatedAt: row.updated_at } : null;
  }

  set(chatId: number, sessionId: string, now: number = Date.now()): void {
    this.db
      .query(
        "INSERT INTO sessions (chat_id, session_id, updated_at) VALUES (?, ?, ?) " +
          "ON CONFLICT(chat_id) DO UPDATE SET session_id = excluded.session_id, updated_at = excluded.updated_at",
      )
      .run(chatId, sessionId, now);
  }

  clear(chatId: number): void {
    this.db.query("DELETE FROM sessions WHERE chat_id = ?").run(chatId);
  }
}
