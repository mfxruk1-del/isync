// Admin-only endpoints: invite people and see who's a member.
import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { db, type InviteRow } from '../db';
import { requireAdmin } from '../auth';

function usernameOf(userId: string | null): string | null {
  if (!userId) return null;
  const row = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as
    | { username: string }
    | undefined;
  return row?.username ?? null;
}

function toInviteClient(i: InviteRow) {
  return {
    id: i.id,
    code: i.code,
    path: `/join/${i.code}`, // front-end builds the full URL
    used: !!i.used_by,
    usedBy: usernameOf(i.used_by),
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  };
}

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  // Generate a new invite link.
  app.post('/api/admin/invites', async (req) => {
    const ownerId = (req as any).userId as string;
    const body = (req.body ?? {}) as { expiresInDays?: number };
    const id = nanoid(16);
    const code = nanoid(20); // unguessable
    const now = Date.now();
    const expiresAt =
      body.expiresInDays && body.expiresInDays > 0
        ? now + body.expiresInDays * 24 * 60 * 60 * 1000
        : null;
    db.prepare(
      'INSERT INTO invites (id, code, created_by, used_by, created_at, expires_at) VALUES (?, ?, ?, NULL, ?, ?)'
    ).run(id, code, ownerId, now, expiresAt);
    const invite = db.prepare('SELECT * FROM invites WHERE id = ?').get(id) as InviteRow;
    return { invite: toInviteClient(invite) };
  });

  // List invites (newest first).
  app.get('/api/admin/invites', async () => {
    const rows = db
      .prepare('SELECT * FROM invites ORDER BY created_at DESC')
      .all() as InviteRow[];
    return { invites: rows.map(toInviteClient) };
  });

  // Revoke an unused invite.
  app.delete('/api/admin/invites/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const invite = db.prepare('SELECT * FROM invites WHERE id = ?').get(id) as
      | InviteRow
      | undefined;
    if (!invite) return reply.code(404).send({ error: 'Not found' });
    if (invite.used_by) {
      return reply.code(400).send({ error: 'That invite was already used' });
    }
    db.prepare('DELETE FROM invites WHERE id = ?').run(id);
    return reply.code(204).send();
  });

  // List members and how many files each has.
  app.get('/api/admin/users', async () => {
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.is_admin, u.created_at,
                (SELECT COUNT(*) FROM files f WHERE f.owner_id = u.id) AS file_count
         FROM users u
         ORDER BY u.created_at ASC`
      )
      .all() as {
      id: string;
      username: string;
      is_admin: number;
      created_at: number;
      file_count: number;
    }[];
    return {
      users: rows.map((u) => ({
        id: u.id,
        username: u.username,
        isAdmin: !!u.is_admin,
        createdAt: u.created_at,
        fileCount: u.file_count,
      })),
    };
  });
}
