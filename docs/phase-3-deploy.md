# Phase 3 (+ share add-ons) — Deploy & Test

This adds **video support** and the **expiry + password** options for share links.
No new settings required.

## Deploy

```powershell
# on your PC
git add .
git commit -m "Share add-ons (expiry + password) + Phase 3 video support"
git push
```

```bash
# on your VPS
cd ~/isync
git pull
docker compose up -d --build
```

> Note: this rebuild also installs **ffmpeg** inside the container (for video
> thumbnails), so the first build after this update takes a little longer.

## Test it ✅

### Video
1. Open the app, tap **+**, and pick a **video** (the picker now accepts videos).
2. It appears in the gallery with a **▶ play badge** and a thumbnail (a frame
   grabbed from the video).
3. Tap it — the video **plays inline** (you can scrub/seek).
4. Tap **Download** — the original video downloads in full quality.
   - Small files show the green **“Verified byte-for-byte identical”** proof.
   - Large videos (>150 MB) stream straight to disk for efficiency and show the
     stored SHA-256 instead (still byte-exact).

### Share link expiry
1. Select photos → **Create share link** → set **“Link expires”** to *After 1 day*
   → create. The link works now; after the expiry it returns “invalid or expired”.

### Password-protected link
1. Select photos → **Create share link** → type a **Password** → create.
2. Open the link in an incognito window — it asks for the password first, and only
   shows the items after the correct password is entered.
3. In **Links**, password-protected shares show a 🔐 icon.

## What’s NOT in this step yet
- **Resumable uploads.** Right now a video uploads in a single request. If the
  connection drops on a very large upload, it restarts. The next sub-step adds
  **resumable, chunked uploads (tus)** so big videos survive interruptions and
  resume where they left off. Say the word and I’ll build it.

## Troubleshooting
- **Video has no thumbnail:** some formats don’t expose an early frame; the video
  still plays and downloads fine. Send me the file type if you want me to tune it.
- **Video won’t play but downloads fine:** the browser may not support that codec
  for inline playback (e.g. some `.mov`/HEVC). Download still gives the exact
  original. Tell me the format and I’ll advise.
