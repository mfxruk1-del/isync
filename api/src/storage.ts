// The heart of the "lossless" promise.
//
// Rule: we write the uploaded bytes to disk EXACTLY as received, and never
// touch that file again. Thumbnails are SEPARATE, smaller copies — the
// original is never re-encoded. A SHA-256 checksum lets us prove it.
import { createWriteStream, createReadStream } from 'node:fs';
import { stat, rm, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform, type Readable } from 'node:stream';
import path from 'node:path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { paths } from './config';
import { extractVideoFrame } from './video';

const THUMB_SIZE = 1024; // big enough to double as a preview for HEIC photos

// Read an image into a sharp-friendly buffer, decoding HEIC (iPhone) first
// since sharp's prebuilt binaries can't always read HEIC directly.
async function loadImageBuffer(path: string, mimeType: string): Promise<Buffer> {
  const raw = await readFile(path);
  if (/heic|heif/i.test(mimeType)) {
    return heicConvert({ buffer: raw, format: 'JPEG', quality: 0.92 });
  }
  return raw;
}

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
export async function storeUpload(
  fileStream: Readable,
  mimeType: string
): Promise<StoredFile> {
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
  const { width, height, hasThumb } = await generateThumbnail(id, mimeType);

  return { id, sha256, size, width, height, hasThumb };
}

// Make a small preview thumbnail for an already-stored original.
// The ORIGINAL is never modified. Used by both the normal and resumable uploads.
export async function generateThumbnail(
  id: string,
  mimeType: string
): Promise<{ width: number | null; height: number | null; hasThumb: boolean }> {
  const dest = originalPath(id);
  let width: number | null = null;
  let height: number | null = null;
  let hasThumb = false;
  try {
    if (mimeType.startsWith('image/')) {
      const buffer = await loadImageBuffer(dest, mimeType);
      const meta = await sharp(buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      await sharp(buffer)
        .rotate() // auto-orient using EXIF (thumbnail only)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(thumbPath(id));
      hasThumb = true;
    } else if (mimeType.startsWith('video/')) {
      const frame = await extractVideoFrame(dest);
      if (frame) {
        const meta = await sharp(frame).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
        await sharp(frame)
          .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(thumbPath(id));
        hasThumb = true;
      }
    }
  } catch {
    // Couldn't make a thumbnail — fine, the file is still stored losslessly.
  }
  return { width, height, hasThumb };
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
