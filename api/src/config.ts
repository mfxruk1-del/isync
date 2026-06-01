// Central configuration, read from environment variables (set in your .env file).
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // .../api/src

export const config = {
  port: Number(process.env.PORT ?? 3000),
  // Where all your real data lives (mounted from the host in Docker).
  dataDir: process.env.DATA_DIR ?? path.resolve(here, '../../data'),
  // The built frontend that we serve to browsers.
  publicDir: process.env.PUBLIC_DIR ?? path.resolve(here, '../public'),
  // The single owner account (created/updated automatically on startup).
  ownerUsername: process.env.OWNER_USERNAME ?? 'admin',
  ownerPassword: process.env.OWNER_PASSWORD ?? '',
  // Secret used to sign the login cookie. MUST be set to something long & random.
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-insecure-secret-change-me',
  isProd: process.env.NODE_ENV === 'production',
};

export const paths = {
  db: path.join(config.dataDir, 'app.db'),
  originals: path.join(config.dataDir, 'originals'),
  thumbs: path.join(config.dataDir, 'thumbs'),
  // Temp area where resumable (tus) uploads are assembled before ingest.
  uploadsTmp: path.join(config.dataDir, 'uploads'),
};

// Make sure the data folders exist before anything else runs.
for (const dir of [config.dataDir, paths.originals, paths.thumbs, paths.uploadsTmp]) {
  mkdirSync(dir, { recursive: true });
}
