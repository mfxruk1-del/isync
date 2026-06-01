// Owner-only endpoints to create, list, and revoke share links.
import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { db, type ShareRow } from '../db';
import { requireAuth } from '../auth';

function shareItemCount(shareId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM share_items WHERE share_id = ?')
    .get(shareId) as { n: number };
  return row.n;
}

function toClient(s: ShareRow) {
  return {
    id: s.id,
    token: s.token,
    path: `/s/${s.token}`, // the front-end turns this into a full URL
    title: s.title,
    expiresAt: s.expires_at,
    hasPassword: !!s.password_hash,
    createdAt: s.created_at,
    itemCount: shareItemCount(s.id),
  };
}

export default async function shareRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Create a share from a set of the owner's files.
  app.post('/api/shares', async (req, reply) => {
    const ownerId = (req as any).userId as string;
    const body = (req.body ?? {}) as {
      fileIds?: string[];
      title?: string;
      expiresInDays?: number;
      password?: string;
    };
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds : [];
    if (fileIds.length === 0) {
      return reply.code(400).send({ error: 'Select at least one item to share' });
    }

    // Keep only files that actually belong to this owner (security check).
    const owned = db
      .prepare(`SELECT id FROM files WHERE owner_id = ? AND id IN (${fileIds.map(() => '?').join(',')})`)
      .all(ownerId, ...fileIds) as { id: string }[];
    if (owned.length === 0) {
      return reply.code(400).send({ error: 'None of those items were found' });
    }

    const id = nanoid(16);
    const token = nanoid(24); // unguessable
    const now = Date.now();
    const expiresAt =
      body.expiresInDays && body.expiresInDays > 0
        ? now + body.expiresInDays * 24 * 60 * 60 * 1000
        : null;
    const passwordHash =
      body.password && body.password.length > 0 ? bcrypt.hashSync(body.password, 10) : null;

    const insertShare = db.prepare(
      'INSERT INTO shares (id, token, owner_id, title, expires_at, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertItem = db.prepare('INSERT INTO share_items (share_id, file_id) VALUES (?, ?)');

    const tx = db.transaction(() => {
      insertShare.run(id, token, ownerId, body.title ?? null, expiresAt, passwordHash, now);
      for (const f of owned) insertItem.run(id, f.id);
    });
    tx();

    const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(id) as ShareRow;
    return { share: toClient(share) };
  });

  // List the owner's shares (newest first).
  app.get('/api/shares', async (req) => {
    const ownerId = (req as any).userId as string;
    const rows = db
      .prepare('SELECT * FROM shares WHERE owner_id = ? ORDER BY created_at DESC')
      .all(ownerId) as ShareRow[];
    return { shares: rows.map(toClient) };
  });

  // Revoke (delete) a share. The link stops working immediately.
  app.delete('/api/shares/:id', async (req, reply) => {
    const ownerId = (req as any).userId as string;
    const { id } = req.params as { id: string };
    const share = db
      .prepare('SELECT * FROM shares WHERE id = ? AND owner_id = ?')
      .get(id, ownerId) as ShareRow | undefined;
    if (!share) return reply.code(404).send({ error: 'Not found' });
    db.prepare('DELETE FROM shares WHERE id = ?').run(id); // cascades to share_items
    return reply.code(204).send();
  });
}
