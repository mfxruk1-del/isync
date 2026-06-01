// Login / logout / "who am I" + invite-based registration.
import type { FastifyInstance } from 'fastify';
import { db, type InviteRow } from '../db';
import {
  clearSession,
  createUser,
  currentUserId,
  findUserById,
  findUserByUsername,
  setSession,
  verifyPassword,
} from '../auth';

// Find an invite that is still usable (exists, unused, not expired).
function getUsableInvite(code: string): InviteRow | null {
  const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(code) as
    | InviteRow
    | undefined;
  if (!invite) return null;
  if (invite.used_by) return null;
  if (invite.expires_at && Date.now() > invite.expires_at) return null;
  return invite;
}

export default async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = (req.body ?? {}) as {
      username?: string;
      password?: string;
    };
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password are required' });
    }
    const user = findUserByUsername(username);
    if (!user || !verifyPassword(user, password)) {
      return reply.code(401).send({ error: 'Wrong username or password' });
    }
    setSession(reply, user.id);
    return { id: user.id, username: user.username, isAdmin: !!user.is_admin };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  app.get('/api/auth/me', async (req, reply) => {
    const uid = currentUserId(req);
    const user = uid ? findUserById(uid) : undefined;
    if (!user) return reply.code(401).send({ error: 'Not logged in' });
    return { id: user.id, username: user.username, isAdmin: !!user.is_admin };
  });

  // Check whether an invite code is still valid (for the join page).
  app.get('/api/auth/invite/:code', async (req) => {
    const { code } = req.params as { code: string };
    return { valid: getUsableInvite(code) !== null };
  });

  // Create an account using an invite code.
  app.post('/api/auth/register', async (req, reply) => {
    const { code, username, password } = (req.body ?? {}) as {
      code?: string;
      username?: string;
      password?: string;
    };
    if (!code || !username || !password) {
      return reply.code(400).send({ error: 'Invite code, username and password are required' });
    }
    if (username.length < 3) {
      return reply.code(400).send({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    const invite = getUsableInvite(code);
    if (!invite) {
      return reply.code(400).send({ error: 'This invite is invalid or has already been used' });
    }
    if (findUserByUsername(username)) {
      return reply.code(409).send({ error: 'That username is taken' });
    }

    const user = createUser(username, password, false);
    db.prepare('UPDATE invites SET used_by = ? WHERE id = ?').run(user.id, invite.id);

    setSession(reply, user.id);
    return { id: user.id, username: user.username, isAdmin: false };
  });
}
