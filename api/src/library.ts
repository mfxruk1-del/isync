// Shared helper for recording a stored file in the database.
// Used by both the normal upload route and the resumable (tus) upload.
import { db, type FileRow } from './db';

export interface NewFileRecord {
  id: string;
  ownerId: string;
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
  width: number | null;
  height: number | null;
  hasThumb: boolean;
}

export function insertFileRecord(rec: NewFileRecord): FileRow {
  db.prepare(
    `INSERT INTO files
     (id, owner_id, original_name, mime_type, size_bytes, sha256, width, height, has_thumb, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    rec.id,
    rec.ownerId,
    rec.originalName,
    rec.mimeType,
    rec.size,
    rec.sha256,
    rec.width,
    rec.height,
    rec.hasThumb ? 1 : 0,
    Date.now()
  );
  return db.prepare('SELECT * FROM files WHERE id = ?').get(rec.id) as FileRow;
}
