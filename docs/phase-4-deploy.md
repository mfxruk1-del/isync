# Phase 4 — Public preview + Install / Open-in-app

Frontend-only changes. No new settings.

## What this adds
- A slim **“Install Vault”** banner on the public share page (and in your gallery)
  for visitors who don’t have the app:
  - **Android / desktop Chrome:** one-tap **Install** button.
  - **iPhone (Safari):** a **“How to install”** popup with Add-to-Home-Screen steps.
  - Hidden automatically if they’re already using the installed app.
- **Link capturing** (`handle_links` in the app manifest): on Chromium, once the
  app is installed, opening a share link **opens it inside the app** instead of a
  browser tab.

## Deploy

```powershell
# on your PC
git add .
git commit -m "Phase 4: public install prompt + open-in-app link capturing"
git push
```

```bash
# on your VPS
cd ~/isync
git pull
docker compose up -d --build
```

## Test it ✅
1. Open a share link in a browser where you **don’t** have the app installed:
   you should see the **“Install Vault”** banner.
   - On Android/desktop Chrome, tap **Install** → it installs.
   - On iPhone Safari, tap **How to install** → follow the 3 steps.
2. Once installed on Android/desktop, open a share link again (e.g. from a chat):
   Chrome offers to **open it in the Vault app**.
3. If you open a link while already inside the installed app, no banner shows
   (you’re already there).

## Honest platform notes
- **iOS cannot deep-link into an installed PWA from a link** — that’s an Apple
  restriction, not a bug. iPhone users install via Add to Home Screen and open
  the app from their home screen; share links still open fine in Safari.
- **Android/desktop Chromium** is where “open in app” works automatically.

## Why there’s no separate throwaway website
Your share page is already public (no login) and served over HTTPS from your own
domain. That’s strictly better than a temporary separate site: one URL, always
secure, nothing extra to host, and the same page upgrades into the app when
installed.
