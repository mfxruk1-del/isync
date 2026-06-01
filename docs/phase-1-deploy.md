# Phase 1 — Deploy & Test (the real app)

This turns your placeholder into the actual Vault app: login, lossless image
upload/download with checksum proof, gallery, and an installable PWA.

## Part A — Push the new code (on your Windows PC)

```powershell
git add .
git commit -m "Phase 1: lossless image vault + installable PWA"
git push
```

## Part B — Update settings on the VPS

SSH into the VPS, then:

```bash
cd ~/isync
git pull
```

You now need three new values in your `.env`. First, generate a strong random
secret:

```bash
openssl rand -hex 32
```

Copy the output, then edit your `.env`:

```bash
nano .env
```

Make sure it has these (keep your existing DOMAIN and ACME_EMAIL):

```
DOMAIN=yourdomain.com
ACME_EMAIL=you@example.com

OWNER_USERNAME=admin
OWNER_PASSWORD=pick-a-strong-password-here
SESSION_SECRET=paste-the-openssl-output-here
```

Save and exit: `Ctrl+O`, `Enter`, `Ctrl+X`.

## Part C — Build and run

```bash
docker compose up -d --build
```

The first build takes a few minutes (it compiles the app). Watch it come up:

```bash
docker compose ps
docker compose logs -f app
```

Look for a line like `Server listening at http://0.0.0.0:3000`. Press `Ctrl+C`
to stop watching.

## Part D — Test it ✅

1. Open `https://yourdomain` on your phone.
2. **Log in** with the `OWNER_USERNAME` / `OWNER_PASSWORD` you set.
3. Tap the **+** button and upload a photo.
4. Tap the photo, then **Download (lossless)**. You should see:
   **“✅ Verified byte-for-byte identical — zero quality loss.”**
   That message means the browser re-hashed the downloaded file and it matched
   the original exactly.
5. **Install the app:**
   - **Android (Chrome):** menu → *Add to Home screen* / *Install app*.
   - **iPhone (Safari):** Share button → *Add to Home Screen*.
   The Vault icon appears on your home screen and opens full-screen like a
   native app.

### The lossless torture test (optional but fun)
Download the photo, then upload that downloaded copy again, download it again —
repeat. The checksum stays identical every time, because we never re-compress.

## Updating later (any future change)

```bash
# on your PC
git add . && git commit -m "..." && git push
# on the VPS
cd ~/isync && git pull && docker compose up -d --build
```

## Troubleshooting

- **Build fails:** copy the error from `docker compose logs app` and send it to me.
- **Can't log in:** double-check `OWNER_USERNAME`/`OWNER_PASSWORD` in `.env`, then
  `docker compose up -d` again (no rebuild needed for .env changes).
- **“Verified” message didn’t show:** make sure you opened the site over
  `https://` (the browser’s secure checksum feature only works on HTTPS).
- **Photo won’t upload:** very large files may hit a limit — tell me the size and
  I’ll bump it.
