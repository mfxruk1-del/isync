// Public share access — NO login required, reached only via the secret token.
// Critical rule: a token can ONLY ever expose the files in its own share.
import { createReadStream } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { db, type FileRow, type ShareRow } from '../db';
import { originalPath, thumbPath } from '../storage';
import { serveFile } from '../serveFile';

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
       WHERE si.share_id = ? AND f.id = ? AND f.deleted_at IS NULL`
    )
    .get(shareId, fileId) as FileRow | undefined;
}

// Has the visitor unlocked this password-protected share? (via the unlock cookie)
function isUnlocked(req: FastifyRequest, share: ShareRow): boolean {
  if (!share.password_hash) return true; // no password = always open
  const raw = req.cookies?.[`u_${share.token}`];
  if (!raw) return false;
  const result = req.unsignCookie(raw);
  return result.valid && result.value === '1';
}

function setUnlocked(reply: FastifyReply, token: string) {
  reply.setCookie(`u_${token}`, '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    maxAge: 60 * 60 * 12, // 12 hours
  });
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

    // Password-protected and not yet unlocked → tell the page to ask for it.
    if (!isUnlocked(req, share)) {
      return { locked: true };
    }

    const files = db
      .prepare(
        `SELECT f.* FROM files f
         JOIN share_items si ON si.file_id = f.id
         WHERE si.share_id = ? AND f.deleted_at IS NULL
         ORDER BY f.created_at DESC`
      )
      .all(share.id) as FileRow[];

    return {
      locked: false,
      title: share.title,
      createdAt: share.created_at,
      expiresAt: share.expires_at,
      files: files.map(toPublic),
    };
  });

  // Submit a password to unlock a protected share.
  app.post('/api/s/:token/unlock', async (req, reply) => {
    const { token } = req.params as { token: string };
    const { password } = (req.body ?? {}) as { password?: string };
    const share = getLiveShare(token);
    if (!share) return reply.code(404).send({ error: 'Invalid link' });
    if (!share.password_hash) return { ok: true }; // nothing to unlock
    if (!password || !bcrypt.compareSync(password, share.password_hash)) {
      return reply.code(401).send({ error: 'Wrong password' });
    }
    setUnlocked(reply, token);
    return { ok: true };
  });

  // Thumbnail of a shared item.
  app.get('/api/s/:token/items/:fileId/thumb', async (req, reply) => {
    const { token, fileId } = req.params as { token: string; fileId: string };
    const share = getLiveShare(token);
    if (!share || !isUnlocked(req, share)) return reply.code(404).send({ error: 'Invalid link' });
    const file = getSharedFile(share.id, fileId);
    if (!file || !file.has_thumb) return reply.code(404).send({ error: 'No thumbnail' });
    reply.header('Content-Type', 'image/webp');
    reply.header('Cache-Control', 'private, max-age=86400');
    return reply.send(createReadStream(thumbPath(fileId)));
  });

  // The original shared file, byte-for-byte (inline preview or download).
  app.get('/api/s/:token/items/:fileId/original', async (req, reply) => {
    const { token, fileId } = req.params as { token: string; fileId: string };
    const { inline } = req.query as { inline?: string };
    const share = getLiveShare(token);
    if (!share || !isUnlocked(req, share)) return reply.code(404).send({ error: 'Invalid link' });
    const file = getSharedFile(share.id, fileId);
    if (!file) return reply.code(404).send({ error: 'Not found' });

    return serveFile(req, reply, {
      path: originalPath(fileId),
      size: file.size_bytes,
      mime: file.mime_type,
      filename: file.original_name,
      sha256: file.sha256,
      inline: !!inline,
    });
  });
}
