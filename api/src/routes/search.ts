// Search: combines CLIP semantic similarity ("cat", "sunset") with OCR text and
// filename matches. Owner-scoped. Degrades to keyword/OCR if AI is unavailable.
import type { FastifyInstance } from 'fastify';
import { db, type FileRow } from '../db';
import { requireAuth } from '../auth';
import { embedText, cosine, bufferToVector } from '../ml';
import { indexStatus } from '../indexer';

function toClient(f: FileRow) {
  return {
    id: f.id,
    name: f.original_name,
    mimeType: f.mime_type,
    size: f.size_bytes,
    sha256: f.sha256,
    width: f.width,
    height: f.height,
    hasThumb: !!f.has_thumb,
    createdAt: f.created_at,
  };
}

export default async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Progress of background indexing (for a "still indexing…" hint in the UI).
  app.get('/api/index/status', async () => indexStatus());

  app.get('/api/search', async (req) => {
    const ownerId = (req as any).userId as string;
    const { q } = req.query as { q?: string };
    const query = (q || '').trim();
    if (!query) return { files: [] };

    const rows = db
      .prepare('SELECT * FROM files WHERE owner_id = ? AND deleted_at IS NULL')
      .all(ownerId) as FileRow[];

    const ql = query.toLowerCase();
    const scores = new Map<string, number>();

    // 1) Filename + OCR text keyword matches (always available).
    for (const f of rows) {
      let score = 0;
      if (f.original_name?.toLowerCase().includes(ql)) score = Math.max(score, 0.9);
      if (f.ocr_text?.toLowerCase().includes(ql)) score = Math.max(score, 0.95);
      if (score > 0) scores.set(f.id, score);
    }

    // 2) Semantic (CLIP) similarity — the "type cat, see cats" magic.
    try {
      const qvec = await embedText(query);
      for (const f of rows) {
        if (!f.embedding) continue;
        const sim = cosine(qvec, bufferToVector(f.embedding));
        if (sim >= 0.22) {
          scores.set(f.id, Math.max(scores.get(f.id) ?? 0, sim));
        }
      }
    } catch {
      // AI not available — keyword/OCR results still returned.
    }

    const byId = new Map(rows.map((r) => [r.id, r]));
    const files = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([id]) => toClient(byId.get(id)!));

    return { files };
  });
}
