# AI Search (CLIP + OCR) — Deploy & Test

Search your library by **content** ("cat", "beach", "sunset") and by **text that
appears in images/videos** (signs, screenshots, documents). Everything runs
locally on your VPS — no cloud, fully private. No new settings.

## What it does
- **CLIP** turns every photo/video frame into a "meaning" vector. When you type
  "cat", it finds visually-cat things — even if the filename says `IMG_2381`.
- **OCR (Tesseract)** reads text inside images so you can search for words that
  appear in them.
- Indexing runs **in the background**, one item at a time. Existing photos get
  **back-filled automatically**. Searching is instant.

## Requirements (important)
- **~1–1.5 GB free RAM** while indexing. Check with `free -h` on the VPS.
- Some **CPU time**: roughly a few seconds per item to index (background). A big
  existing library can take a while to fully index — search keeps improving as it
  catches up.
- **Internet on the VPS** the first time (to download the small AI models, which
  are then cached in `data/models` and reused).

## Deploy

```powershell
# on your PC
git add .
git commit -m "AI search: CLIP semantic + OCR text search with background indexing"
git push
```

```bash
# on your VPS
cd ~/isync
git pull
docker compose up -d --build
```

> This build is bigger than usual (it installs the AI runtime). The **first**
> search or upload also downloads the models once — watch `docker compose logs -f app`.

## Test it ✅
1. Upload a clear photo of something obvious (a dog, a car, the sky).
2. Wait a few seconds (watch the **"Making N items searchable…"** banner shrink).
3. In the search box, type the thing — e.g. **dog** — and it should appear,
   regardless of the filename.
4. Upload a photo with visible text (a sign, a screenshot) and search a **word**
   from it — OCR should find it.
5. Clear the search box (✕) to return to your full gallery.

## How accurate is it?
- Content search is good but not perfect — it ranks by similarity, so the most
  relevant items float to the top. Try simple nouns ("flower", "snow", "food").
- OCR works best on clear, reasonably large text.

## Troubleshooting
- **Search finds nothing by content:** indexing may still be running (check the
  banner) or the model is still downloading (check `docker compose logs -f app`).
- **Logs say “AI indexing disabled”:** the model failed to load (often low RAM).
  Run `docker stats` and `free -h`. Tell me your numbers and I'll tune it (smaller
  model, or OCR-only mode).
- **High CPU for a while after first deploy:** that's the one-time back-fill of
  your existing library. It settles once everything is indexed.

## Possible upgrades later
- A real **vector index** (sqlite-vec) for instant search across huge libraries.
- **Face grouping** ("show me photos of this person").
- OCR on full-resolution images for tiny text.
- Multi-language OCR.
