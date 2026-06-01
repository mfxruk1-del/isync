// Login/session helpers. Single owner for now, but built so multi-user is easy.
import type { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db, type UserRow } from './db';
import { config } from './config';

const COOKIE = 'sid';

// Ensure the owner account exists and matches the password in your .env.
// Running this on every startup means changing OWNER_PASSWORD in .env just works.
export function ensureOwner() {
  if (!config.ownerPassword) {
    throw new Error('OWNER_PASSWORD is not set. Set it in your .env file.');
  }
  const hash = bcrypt.hashSync(config.ownerPassword, 10);
  const existing = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(config.ownerUsername) as UserRow | undefined;

  if (!existing) {
    db.prepare(
      'INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, 1, ?)'
    ).run(nanoid(16), config.ownerUsername, hash, Date.now());
  } else {
    // Keep the owner's password in sync with .env and ensure they're an admin.
    db.prepare('UPDATE users SET password_hash = ?, is_admin = 1 WHERE id = ?').run(
      hash,
      existing.id
    );
  }
}

// Create a brand-new account (used when someone signs up with an invite).
export function createUser(username: string, password: string, isAdmin = false): UserRow {
  const id = nanoid(16);
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, hash, isAdmin ? 1 : 0, Date.now());
  return findUserById(id)!;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function verifyPassword(user: UserRow, password: string): boolean {
  return bcrypt.compareSync(password, user.password_hash);
}

// Set the signed login cookie (integrity-protected; can't be tampered with).
export function setSession(reply: FastifyReply, userId: string) {
  reply.setCookie(COOKIE, userId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd, // HTTPS-only in production
    signed: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearSession(reply: FastifyReply) {
  reply.clearCookie(COOKIE, { path: '/' });
}

// Read the current user's id from the signed cookie (or null).
export function currentUserId(req: FastifyRequest): string | null {
  const raw = req.cookies?.[COOKIE];
  if (!raw) return null;
  const result = req.unsignCookie(raw);
  return result.valid && result.value ? result.value : null;
}

// preHandler guard: block the request with 401 if not logged in.
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const uid = currentUserId(req);
  if (!uid || !findUserById(uid)) {
    return reply.code(401).send({ error: 'Not logged in' });
  }
  (req as any).userId = uid;
}

// preHandler guard: must be logged in AND an admin.
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const uid = currentUserId(req);
  const user = uid ? findUserById(uid) : undefined;
  if (!user) return reply.code(401).send({ error: 'Not logged in' });
  if (!user.is_admin) return reply.code(403).send({ error: 'Admins only' });
  (req as any).userId = uid;
}
