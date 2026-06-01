// Public share access — NO login required, reached only via the secret token.
// Critical rule: a token can ONLY ever expose the files in its own share.
import { createReadStream } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { db, type FileRow, type ShareRow } from '../db';
import { originalPath, thumbPath } from '../storage';

function getLiveShare(token: string): ShareRow | null {
  const share = db.prepare('SELECT * FROM shares WHERE token = ?').get(token) as
    | ShareRow
    | undefined;
  if (!share) return null;
  if (share.expires_at && Date.now() > share.expires_at) return null; // expired
  return share;
}

// Returns the file ONLY if it is part of this share.
function getSharedFile(shareId: string, fileId: string): FileRow | undefined {
  return db
    .prepare(
      `SELECT f.* FROM files f
       JOIN share_items si ON si.file_id = f.id
       WHERE si.share_id = ? AND f.id = ?`
    )
    .get(shareId, fileId) as FileRow | undefined;
}

function toPublic(f: FileRow) {
  return {
    id: f.id,
    name: f.original_name,
    mimeType: f.mime_type,
    size: f.size_bytes,
    sha256: f.sha256,
    width: f.width,
    height: f.height,
    hasThumb: !!f.has_thumb,
  };
}

export default async function publicRoutes(app: FastifyInstance) {
  // Share contents (metadata + the list of shared items only).
  app.get('/api/s/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const share = getLiveShare(token);
    if (!share) return reply.code(404).send({ error: 'This link is invalid or has expired' });

    const files = db
      .prepare(
        `SELECT f.* FROM files f
         JOIN share_items si ON si.file_id = f.id
         WHERE si.share_id = ?
         ORDER BY f.created_at DESC`
      )
      .all(share.id) as FileRow[];

    return {
      title: share.title,
      createdAt: share.created_at,
      expiresAt: share.expires_at,
      files: files.map(toPublic),
    };
  });

  // Thumbnail of a shared item.
  app.get('/api/s/:token/items/:fileId/thumb', async (req, reply) => {
    const { token, fileId } = req.params as { token: string; fileId: string };
    const share = getLiveShare(token);
    if (!share) return reply.code(404).send({ error: 'Invalid link' });
    const file = getSharedFile(share.id, fileId);
    if (!file || !file.has_thumb) return reply.code(404).send({ error: 'No thumbnail' });
    reply.header('Content-Type', 'image/webp');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(createReadStream(thumbPath(fileId)));
  });

  // The original shared file, byte-for-byte (inline preview or download).
  app.get('/api/s/:token/items/:fileId/original', async (req, reply) => {
    const { token, fileId } = req.params as { token: string; fileId: string };
    const { inline } = req.query as { inline?: string };
    const share = getLiveShare(token);
    if (!share) return reply.code(404).send({ error: 'Invalid link' });
    const file = getSharedFile(share.id, fileId);
    if (!file) return reply.code(404).send({ error: 'Not found' });

    const disposition = inline ? 'inline' : 'attachment';
    const safeName = encodeURIComponent(file.original_name);
    reply.header('Content-Type', file.mime_type || 'application/octet-stream');
    reply.header('Content-Length', file.size_bytes);
    reply.header('Content-Disposition', `${disposition}; filename*=UTF-8''${safeName}`);
    reply.header('X-Checksum-SHA256', file.sha256);
    return reply.send(createReadStream(originalPath(fileId)));
  });
}
