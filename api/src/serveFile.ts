// Streams a file to the browser, byte-for-byte, with HTTP Range support.
// Range support lets videos play/seek and lets downloads resume.
import { createReadStream } from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface ServeOpts {
  path: string;
  size: number;
  mime: string;
  filename: string;
  sha256: string;
  inline: boolean;
}

export function serveFile(req: FastifyRequest, reply: FastifyReply, opts: ServeOpts) {
  const { path, size, mime, filename, sha256, inline } = opts;
  const safeName = encodeURIComponent(filename);

  reply.header('Content-Type', mime || 'application/octet-stream');
  reply.header('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${safeName}`);
  reply.header('X-Checksum-SHA256', sha256);
  reply.header('Accept-Ranges', 'bytes');

  const range = req.headers.range;
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : size - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end > size - 1) end = size - 1;
      if (start > end || start >= size) {
        return reply.code(416).header('Content-Range', `bytes */${size}`).send();
      }
      reply.code(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${size}`);
      reply.header('Content-Length', end - start + 1);
      return reply.send(createReadStream(path, { start, end }));
    }
  }

  reply.header('Content-Length', size);
  return reply.send(createReadStream(path));
}
