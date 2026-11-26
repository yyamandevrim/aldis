import { Database } from "bun:sqlite";

export function openDb(path: string): Database {
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(
    "CREATE TABLE IF NOT EXISTS sessions (chat_id INTEGER PRIMARY KEY, session_id TEXT NOT NULL, updated_at INTEGER NOT NULL);",
  );
  return db;
}
