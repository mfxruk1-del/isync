// Permanently removes Trash items older than the retention window.
// Runs on startup and every few hours.
import { db } from './db';
import { deleteStoredFile } from './storage';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = Date.now() - RETENTION_MS;
  const rows = db
    .prepare('SELECT id FROM files WHERE deleted_at IS NOT NULL AND deleted_at < ?')
    .all(cutoff) as { id: string }[];
  for (const r of rows) {
    await deleteStoredFile(r.id);
    db.prepare('DELETE FROM files WHERE id = ?').run(r.id);
  }
  return rows.length;
}

export function startTrashPurger() {
  purgeExpiredTrash().catch(() => {});
  setInterval(() => purgeExpiredTrash().catch(() => {}), 6 * 60 * 60 * 1000); // every 6h
}
