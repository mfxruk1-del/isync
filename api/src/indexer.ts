// Background indexing: for each image/video, compute a CLIP embedding and OCR
// text so it becomes searchable. Runs one file at a time (CPU-friendly) and
// won't block uploads. Safe to crash: anything not yet indexed is retried on
// the next startup.
import { db, type FileRow } from './db';
import { thumbPath, originalPath } from './storage';
import { embedImageFile, ocrImageFile } from './ml';

const queue: string[] = [];
let running = false;
let aiDisabled = false; // set true if the AI model fails to load at all

export function enqueueIndex(fileId: string) {
  queue.push(fileId);
  kick();
}

export function indexStatus() {
  const total = (db.prepare('SELECT COUNT(*) AS n FROM files').get() as { n: number }).n;
  const indexed = (
    db.prepare('SELECT COUNT(*) AS n FROM files WHERE indexed_at IS NOT NULL').get() as {
      n: number;
    }
  ).n;
  return { total, indexed, pending: Math.max(0, total - indexed), aiDisabled };
}

// Queue everything that hasn't been indexed yet (called on startup).
export function startIndexer() {
  const rows = db.prepare('SELECT id FROM files WHERE indexed_at IS NULL').all() as {
    id: string;
  }[];
  for (const r of rows) queue.push(r.id);
  kick();
}

function kick() {
  if (!running && !aiDisabled) {
    running = true;
    setImmediate(loop);
  }
}

async function loop() {
  while (queue.length && !aiDisabled) {
    const id = queue.shift()!;
    try {
      await indexOne(id);
    } catch (err) {
      if ((err as { __aiFail?: boolean }).__aiFail) {
        aiDisabled = true;
        queue.length = 0;
        // eslint-disable-next-line no-console
        console.error('[indexer] AI indexing disabled:', (err as Error).message);
      } else {
        // Non-fatal (e.g. OCR hiccup) — mark done so we don't loop forever.
        markIndexed(id, null, null);
      }
    }
  }
  running = false;
}

async function indexOne(id: string) {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as FileRow | undefined;
  if (!file || file.indexed_at) return;

  const isImage = file.mime_type.startsWith('image/');
  const isVideo = file.mime_type.startsWith('video/');

  let embedding: Buffer | null = null;
  let ocr: string | null = null;

  // Use the thumbnail (small + fast; for video it's the keyframe). Fall back to
  // the original for images without a thumbnail.
  const src = file.has_thumb ? thumbPath(id) : isImage ? originalPath(id) : null;

  if (src && (isImage || isVideo)) {
    try {
      const vec = await embedImageFile(src);
      embedding = Buffer.from(vec.buffer.slice(0));
    } catch (e) {
      const err = new Error(`CLIP failed: ${(e as Error).message}`);
      (err as { __aiFail?: boolean }).__aiFail = true;
      throw err; // disable indexing rather than burn CPU on a broken model
    }
    try {
      ocr = await ocrImageFile(src);
    } catch {
      // OCR is best-effort; ignore failures.
    }
  }

  markIndexed(id, embedding, ocr);
}

function markIndexed(id: string, embedding: Buffer | null, ocr: string | null) {
  db.prepare('UPDATE files SET embedding = ?, ocr_text = ?, indexed_at = ? WHERE id = ?').run(
    embedding,
    ocr,
    Date.now(),
    id
  );
}
