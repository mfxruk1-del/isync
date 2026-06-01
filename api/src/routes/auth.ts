// Login / logout / "who am I" endpoints.
import type { FastifyInstance } from 'fastify';
import {
  clearSession,
  currentUserId,
  findUserById,
  findUserByUsername,
  setSession,
  verifyPassword,
} from '../auth';

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
    return { id: user.id, username: user.username };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  app.get('/api/auth/me', async (req, reply) => {
    const uid = currentUserId(req);
    const user = uid ? findUserById(uid) : undefined;
    if (!user) return reply.code(401).send({ error: 'Not logged in' });
    return { id: user.id, username: user.username };
  });
}
