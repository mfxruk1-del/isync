// Resumable, chunked uploads using the tus protocol (great for big videos).
// The client (Uppy) uploads in chunks; if the connection drops, it resumes
// from where it left off instead of starting over.
//
// When an upload finishes, we INGEST it into the lossless store: move the
// assembled file into /data/originals, record its SHA-256, and make a thumbnail.
import { rename, rm, stat } from 'node:fs/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Server } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { nanoid } from 'nanoid';
import { paths } from '../config';
import { currentUserId, findUserById } from '../auth';
import { originalPath, hashStoredFile, generateThumbnail } from '../storage';
import { insertFileRecord } from '../library';
import { enqueueIndex } from '../indexer';

const TUS_PATH = '/api/uploads';

export default async function uploadRoutes(app: FastifyInstance) {
  const tus = new Server({
    path: TUS_PATH,
    datastore: new FileStore({ directory: paths.uploadsTmp }),
    maxSize: 10 * 1024 * 1024 * 1024, // 10 GB ceiling
    // Return a relative Location header so it works behind the HTTPS proxy
    // (avoids any http/https mixed-content issue).
    relativeLocation: true,
    respectForwardedHeaders: true,
    // After the final chunk arrives: move the file into the vault, byte-for-byte.
    async onUploadFinish(req, res, upload) {
      const ownerId = (req as unknown as { userId?: string }).userId;
      if (!ownerId) throw { status_code: 401, body: 'Not logged in' };

      const srcPath = upload.storage?.path;
      if (!srcPath) throw { status_code: 500, body: 'Upload path missing' };

      const meta = upload.metadata ?? {};
      const originalName = meta.filename || meta.name || 'upload';
      const mimeType = meta.filetype || meta.type || 'application/octet-stream';

      // Move the completed upload into the originals store (same disk = instant).
      const fileId = nanoid(16);
      await rename(srcPath, originalPath(fileId));
      await rm(`${srcPath}.json`, { force: true }); // remove tus sidecar metadata

      const sha256 = await hashStoredFile(fileId);
      const { size } = await stat(originalPath(fileId));
      const { width, height, hasThumb } = await generateThumbnail(fileId, mimeType);

      insertFileRecord({
        id: fileId,
        ownerId,
        originalName,
        mimeType,
        size,
        sha256,
        width,
        height,
        hasThumb,
      });
      enqueueIndex(fileId); // make it searchable in the background

      return res;
    },
  });

  // tus PATCH chunks use this content type — register a no-op parser so Fastify
  // doesn't try to read the body itself (tus reads the raw stream instead).
  app.addContentTypeParser('application/offset+octet-stream', (_req, _payload, done) =>
    done(null)
  );

  // Require login, stash the user id on the raw request, then hand off to tus.
  function handle(req: FastifyRequest, reply: FastifyReply) {
    const uid = currentUserId(req);
    if (!uid || !findUserById(uid)) {
      reply.code(401).send({ error: 'Not logged in' });
      return;
    }
    (req.raw as unknown as { userId: string }).userId = uid;
    reply.hijack(); // we let tus own the response
    tus.handle(req.raw, reply.raw).catch(() => {
      try {
        if (!reply.raw.headersSent) reply.raw.writeHead(500);
        reply.raw.end();
      } catch {
        /* connection already gone */
      }
    });
  }

  app.all(TUS_PATH, handle);
  app.all(`${TUS_PATH}/*`, handle);
}
