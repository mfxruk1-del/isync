// Extract a single still frame from a video using ffmpeg.
// Used ONLY to make a thumbnail — the original video is never modified.
import { spawn } from 'node:child_process';

// Grab a frame near the start and return it as a JPEG buffer (or null on failure).
export function extractVideoFrame(filePath: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    // -ss 1  : seek ~1 second in (skip black intro frames)
    // -frames:v 1 : take exactly one frame
    // output an MJPEG image to stdout
    const args = [
      '-ss', '1',
      '-i', filePath,
      '-frames:v', '1',
      '-f', 'image2',
      '-vcodec', 'mjpeg',
      'pipe:1',
    ];
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.on('error', () => resolve(null)); // ffmpeg missing or failed to start
    ff.on('close', (code) => {
      if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
      else resolve(null);
    });
  });
}
