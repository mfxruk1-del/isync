# Phase 2 — Deploy & Test (selective share links)

No new settings needed — just ship the new code.

## Deploy

```powershell
# on your PC
git add .
git commit -m "Phase 2: selective share links (create, preview, revoke)"
git push
```

```bash
# on your VPS
cd ~/isync
git pull
docker compose up -d --build
```

## Test it ✅

1. Open `https://yourdomain` and log in.
2. Tap **“Select to share”** (top right of the gallery).
   - Tap a few photos to tick them (✓).
   - Tap **“Create share link”** → a popup shows your link. Tap **Copy**.
3. **Open the link in a private/incognito window** (or send it to your phone /
   a friend). You should see **only the photos you picked** — nothing else from
   your vault — with no login required.
4. In that shared view, open a photo and tap **Download (lossless)** — you’ll get
   the same green **“Verified byte-for-byte identical”** proof.
5. Back in the app, tap **“Links”** (top right) to see all your share links.
   Tap **Revoke** on one, then refresh the incognito tab — the link is now dead.

### Things to confirm
- The link shows ONLY the selected items.
- A non-logged-in browser can view + download them.
- Revoking a link kills it immediately.

## How the security works
- Each link has a long, random, unguessable token (`/s/AbC123…`).
- The public endpoints can ONLY serve files that belong to that specific share —
  the database join makes it impossible for a link to reach any other file.
- Revoking deletes the share, so the token stops working at once.

## Optional add-ons (easy to add later)
- **Expiry dates** (the backend already supports `expiresInDays`).
- **Password-protected links.**
- These can be turned on whenever you want — just say the word.
