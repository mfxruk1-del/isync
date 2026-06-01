# Phase 3b — Resumable Uploads (tus) — Deploy & Test

Big files now upload in **16 MB chunks** using the **tus** protocol via **Uppy**.
If the connection drops, the upload **resumes** from where it stopped instead of
starting over. When an upload finishes, the server moves it into the lossless
store, records its SHA-256, and makes a thumbnail — same guarantees as before.

No new settings.

## Deploy

```powershell
# on your PC
git add .
git commit -m "Phase 3b: resumable chunked uploads (tus + Uppy)"
git push
```

```bash
# on your VPS
cd ~/isync
git pull
docker compose up -d --build
```

## Test it ✅

1. **Normal upload still works:** upload a photo or small video — it appears in
   the gallery as usual, downloadable losslessly.
2. **Chunked upload:** open your browser’s DevTools → **Network** tab, then upload
   a larger video. You’ll see repeated **PATCH** requests to `/api/uploads/…` —
   that’s the file going up in chunks.
3. **The resume test (the important one):**
   - Start uploading a large video.
   - Mid-upload, turn **Wi-Fi/airplane mode off for a few seconds**, then back on.
   - The upload **continues from where it left off** (you’ll see the progress bar
     keep climbing rather than restarting at 0%).
4. **Lossless check:** once it finishes, open the video, **Download**, and confirm
   it plays / is byte-identical.

## How it works (plain English)
- The browser (Uppy) cuts the file into 16 MB chunks and sends them one by one.
- The server (tus) tracks how many bytes it has received. If a chunk fails, the
  client asks “how far did you get?” and continues from there.
- When the last chunk lands, the server assembles the file, moves it into
  `/data/originals`, hashes it (SHA-256), and generates a thumbnail.

## Notes / limits
- Resume works across dropped connections and retries **within the same browser
  session**. Resuming after a full page refresh / browser restart would need an
  extra piece (Uppy “Golden Retriever”) — easy to add later if you want it.
- The temporary, in-progress chunks live in `/data/uploads` and are cleaned up
  once an upload completes.

## Troubleshooting
- **Upload fails immediately:** check `docker compose logs -f app` while uploading
  and send me anything red.
- **Stuck at 100% then errors:** that’s usually the server-side ingest (thumbnail
  or move) — the logs will show it; send them over.
