# Recycle bin (Trash) — Deploy & Test

Deleting a photo/video now moves it to a **Trash** you can restore from for
**30 days**, instead of removing it instantly. After 30 days, trashed items are
permanently deleted automatically. No new settings.

## What changed
- **Delete = move to Trash** (soft delete). The item leaves your gallery, search,
  and any share links — but is recoverable.
- A new **Trash** screen (⋯ menu → Trash) lists deleted items with how many days
  remain, plus **Restore** and **Delete forever** per item, and **Empty trash**.
- A background job permanently purges items older than 30 days (runs on startup
  and every 6 hours).
- The header buttons (People / Links / Trash / Sign out) are now tucked into a
  tidy **⋯ menu** so the top bar stays clean.

## Deploy

```powershell
git add .
git commit -m "Recycle bin: 30-day trash with restore + auto-purge"
git push
```

```bash
cd ~/isync
git pull
docker compose up -d --build
```

> The database auto-migrates on startup (adds a `deleted_at` column). Existing
> photos and shares are untouched.

## Test it ✅
1. Open a photo and tap **Delete** → confirm **“Move to Trash?”**. It disappears
   from the gallery.
2. Tap the **⋯** menu (top right) → **🗑️ Trash**.
3. You'll see the item with **“deletes in 30d.”**
   - Tap **Restore** → close Trash → it's back in your gallery.
   - Or tap **Delete** → it's gone permanently (with a confirm).
4. **Empty trash** removes everything in the Trash at once.
5. Confirm a trashed item **doesn't show up** in search or in an existing share
   link (open the share in incognito — the deleted item is gone), and **comes
   back** in the share if you restore it.

## Notes
- Trashed items still take up disk space until they're purged or you empty the
  Trash — so "Empty trash" frees space immediately.
- Want a different retention window (e.g. 7 or 60 days)? It's a one-line change —
  just say the number.
