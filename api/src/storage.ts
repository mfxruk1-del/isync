// The heart of the "lossless" promise.
//
// Rule: we write the uploaded bytes to disk EXACTLY as received, and never
// touch that file again. Thumbnails are SEPARATE, smaller copies — the
// original is never re-encoded. A SHA-256 checksum lets us prove it.
import { createWriteStream, createReadStream } from 'node:fs';
import { stat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform, type Readable } from 'node:stream';
import path from 'node:path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { paths } from './config';

export function originalPath(id: string) {
  return path.join(paths.originals, id);
}
export function thumbPath(id: string) {
  return path.join(paths.thumbs, `${id}.webp`);
}

export interface StoredFile {
  id: string;
  sha256: string;
  size: number;
  width: number | null;
  height: number | null;
  hasThumb: boolean;
}

// Stream an upload to disk while hashing it in one pass (no extra memory).
export async function storeUpload(fileStream: Readable): Promise<StoredFile> {
  const id = nanoid(16);
  const dest = originalPath(id);
  const hash = createHash('sha256');

  // A pass-through that updates the hash as bytes flow to the file unchanged.
  const hasher = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk);
      cb(null, chunk);
    },
  });

  await pipeline(fileStream, hasher, createWriteStream(dest));

  const sha256 = hash.digest('hex');
  const { size } = await stat(dest);

  // Try to read image dimensions + make a small thumbnail (originals untouched).
  let width: number | null = null;
  let height: number | null = null;
  let hasThumb = false;
  try {
    const meta = await sharp(dest).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;

    await sharp(dest)
      .rotate() // auto-orient the THUMBNAIL using EXIF; original is not changed
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(thumbPath(id));
    hasThumb = true;
  } catch {
    // Not an image sharp can read (or a video) — fine, we just skip the thumbnail.
  }

  return { id, sha256, size, width, height, hasThumb };
}

// Re-hash a stored original to PROVE it still matches what we recorded.
export async function hashStoredFile(id: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(originalPath(id))) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

// Delete both the original and its thumbnail.
export async function deleteStoredFile(id: string): Promise<void> {
  await rm(originalPath(id), { force: true });
  await rm(thumbPath(id), { force: true });
}
