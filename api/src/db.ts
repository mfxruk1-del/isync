// The database: a single SQLite file holding metadata (NOT your actual media).
// Your photos/videos live as real files on disk; this just remembers facts about them.
import Database from 'better-sqlite3';
import { paths } from './config';

export const db = new Database(paths.db);

// WAL mode = faster and safer for concurrent reads/writes.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tables. Designed multi-user from day one (every file has an owner),
// so turning on multiple accounts later needs no schema rewrite.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id            TEXT PRIMARY KEY,
    owner_id      TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type     TEXT NOT NULL,
    size_bytes    INTEGER NOT NULL,
    sha256        TEXT NOT NULL,        -- proves the stored bytes are unchanged
    width         INTEGER,
    height        INTEGER,
    has_thumb     INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id, created_at DESC);
`);

// --- Types describing a row, for convenience ---
export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
}

export interface FileRow {
  id: string;
  owner_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  has_thumb: number;
  created_at: number;
}
