// Main entry point: wires up the API and serves the installed app.
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { config } from './config';
import { ensureOwner } from './auth';
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';

const app = Fastify({
  logger: true,
  // Allow large uploads (room for big photos now, big videos later).
  bodyLimit: 5 * 1024 * 1024 * 1024,
});

async function main() {
  // Create/refresh the owner account from your .env settings.
  ensureOwner();

  // Signed cookies for login sessions.
  await app.register(cookie, { secret: config.sessionSecret });

  // Multipart file uploads (streamed straight to disk).
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 * 1024, files: 100 },
  });

  // API routes.
  await app.register(authRoutes);
  await app.register(fileRoutes);

  // Serve the built frontend (the PWA) as static files.
  await app.register(fastifyStatic, {
    root: config.publicDir,
    wildcard: false,
  });

  // Single-page-app fallback: any non-API GET returns index.html so the
  // app's own routing works (and refreshes don't 404).
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.method === 'GET' && !req.url.startsWith('/api')) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not found' });
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
