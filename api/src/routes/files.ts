// Upload, list, preview, download (lossless), verify, and delete files.
import { createReadStream } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { db, type FileRow } from '../db';
import { requireAuth } from '../auth';
import {
  storeUpload,
  hashStoredFile,
  deleteStoredFile,
  originalPath,
  thumbPath,
} from '../storage';

// Shape we send to the browser (camelCase, no internal columns leaked).
function toClient(f: FileRow) {
  return {
    id: f.id,
    name: f.original_name,
    mimeType: f.mime_type,
    size: f.size_bytes,
    sha256: f.sha256,
    width: f.width,
    height: f.height,
    hasThumb: !!f.has_thumb,
    createdAt: f.created_at,
  };
}

function getOwnedFile(id: string, ownerId: string): FileRow | undefined {
  return db
    .prepare('SELECT * FROM files WHERE id = ? AND owner_id = ?')
    .get(id, ownerId) as FileRow | undefined;
}

export default async function fileRoutes(app: FastifyInstance) {
  // Everything in here requires login.
  app.addHook('preHandler', requireAuth);

  // --- Upload one or more files ---
  app.post('/api/files', async (req, reply) => {
    const ownerId = (req as any).userId as string;
    const saved: ReturnType<typeof toClient>[] = [];

    // Stream through each uploaded file part, storing bytes exactly.
    for await (const part of req.files()) {
      const stored = await storeUpload(part.file);
      const now = Date.now();
      db.prepare(
        `INSERT INTO files
         (id, owner_id, original_name, mime_type, size_bytes, sha256, width, height, has_thumb, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        stored.id,
        ownerId,
        part.filename,
        part.mimetype,
        stored.size,
        stored.sha256,
        stored.width,
        stored.height,
        stored.hasThumb ? 1 : 0,
        now
      );
      const row = getOwnedFile(stored.id, ownerId)!;
      saved.push(toClient(row));
    }

    if (saved.length === 0) {
      return reply.code(400).send({ error: 'No files were uploaded' });
    }
    return { files: saved };
  });

  // --- List the owner's files (newest first) ---
  app.get('/api/files', async (req) => {
    const ownerId = (req as any).userId as string;
    const rows = db
      .prepare('SELECT * FROM files WHERE owner_id = ? ORDER BY created_at DESC')
      .all(ownerId) as FileRow[];
    return { files: rows.map(toClient) };
  });

  // --- Thumbnail (small preview copy; original is never touched) ---
  app.get('/api/files/:id/thumb', async (req, reply) => {
    const ownerId = (req as any).userId as string;
    const { id } = req.params as { id: string };
    const file = getOwnedFile(id, ownerId);
    if (!file || !file.has_thumb) return reply.code(404).send({ error: 'No thumbnail' });
    reply.header('Content-Type', 'image/webp');
    reply.header('Cache-Control', 'private, max-age=86400');
    return reply.send(createReadStream(thumbPath(id)));
  });

  // --- The original file, byte-for-byte ---
  // ?inline=1 shows it in the browser (for preview); otherwise it downloads.
  app.get('/api/files/:id/original', async (req, reply) => {
    const ownerId = (req as any).userId as string;
    const { id } = req.params as { id: string };
    const { inline } = req.query as { inline?: string };
    const file = getOwnedFile(id, ownerId);
    if (!file) return reply.code(404).send({ error: 'Not found' });

    const disposition = inline ? 'inline' : 'attachment';
    const safeName = encodeURIComponent(file.original_name);
    reply.header('Content-Type', file.mime_type || 'application/octet-stream');
    reply.header('Content-Length', file.size_bytes);
    reply.header('Content-Disposition', `${disposition}; filename*=UTF-8''${safeName}`);
    // Expose the recorded checksum so the browser can verify a lossless download.
    reply.header('X-Checksum-SHA256', file.sha256);
    return reply.send(createReadStream(originalPath(id)));
  });

  // --- Prove integrity: re-hash the stored original and compare ---
  app.get('/api/files/:id/verify', async (req, reply) => {
    const ownerId = (req as any).userId as string;
    const { id } = req.params as { id: string };
    const file = getOwnedFile(id, ownerId);
    if (!file) return reply.code(404).send({ error: 'Not found' });
    const actual = await hashStoredFile(id);
    return { ok: actual === file.sha256, expected: file.sha256, actual };
  });

  // --- Delete a file (original + thumbnail + metadata) ---
  app.delete('/api/files/:id', async (req, reply) => {
    const ownerId = (req as any).userId as string;
    const { id } = req.params as { id: string };
    const file = getOwnedFile(id, ownerId);
    if (!file) return reply.code(404).send({ error: 'Not found' });
    await deleteStoredFile(id);
    db.prepare('DELETE FROM files WHERE id = ?').run(id);
    return reply.code(204).send();
  });
}
