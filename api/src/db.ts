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

  -- A share = a link the owner created that exposes a chosen set of files.
  CREATE TABLE IF NOT EXISTS shares (
    id          TEXT PRIMARY KEY,
    token       TEXT UNIQUE NOT NULL,   -- the unguessable part of the link
    owner_id    TEXT NOT NULL,
    title       TEXT,
    expires_at  INTEGER,                -- NULL = never expires
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Which files belong to which share (only these are ever exposed by the link).
  CREATE TABLE IF NOT EXISTS share_items (
    share_id    TEXT NOT NULL,
    file_id     TEXT NOT NULL,
    PRIMARY KEY (share_id, file_id),
    FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id)  REFERENCES files(id)  ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id, created_at DESC);
`);

// Invite links let an admin add family/friends without open registration.
db.exec(`
  CREATE TABLE IF NOT EXISTS invites (
    id          TEXT PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,
    created_by  TEXT NOT NULL,
    used_by     TEXT,              -- NULL until someone signs up with it
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// --- Lightweight migrations (safe to run every startup) ---
// Add password_hash to shares if an older database doesn't have it yet.
const shareCols = db.prepare('PRAGMA table_info(shares)').all() as { name: string }[];
if (!shareCols.some((c) => c.name === 'password_hash')) {
  db.exec('ALTER TABLE shares ADD COLUMN password_hash TEXT');
}

// Add is_admin to users for existing databases.
const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
if (!userCols.some((c) => c.name === 'is_admin')) {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
}

// Add AI-search columns to files: a CLIP embedding (vector), OCR text, and a
// timestamp marking when the file was processed by the indexer.
const fileCols2 = db.prepare('PRAGMA table_info(files)').all() as { name: string }[];
if (!fileCols2.some((c) => c.name === 'embedding')) {
  db.exec('ALTER TABLE files ADD COLUMN embedding BLOB');
}
if (!fileCols2.some((c) => c.name === 'ocr_text')) {
  db.exec('ALTER TABLE files ADD COLUMN ocr_text TEXT');
}
if (!fileCols2.some((c) => c.name === 'indexed_at')) {
  db.exec('ALTER TABLE files ADD COLUMN indexed_at INTEGER');
}
// Soft-delete: when set, the file is in the Trash (auto-purged after 30 days).
if (!fileCols2.some((c) => c.name === 'deleted_at')) {
  db.exec('ALTER TABLE files ADD COLUMN deleted_at INTEGER');
}

// --- Types describing a row, for convenience ---
export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: number;
}

export interface InviteRow {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  created_at: number;
  expires_at: number | null;
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
  embedding: Buffer | null;
  ocr_text: string | null;
  indexed_at: number | null;
  deleted_at: number | null;
}

export interface ShareRow {
  id: string;
  token: string;
  owner_id: string;
  title: string | null;
  expires_at: number | null;
  password_hash: string | null;
  created_at: number;
}
