# Import from the device gallery (Android + iOS) — Deploy & Test

Three things in this update:
1. **Native-feeling picker** — the **+** button now offers **🖼️ Photos & videos**
   (opens your gallery) and **📷 Take photo/video** (opens the camera).
2. **HEIC support** — iPhone `.heic` photos now get thumbnails and previews
   (before, they'd upload fine but show a blank icon).
3. **Android “Share to Vault”** — installed Android users can open Google
   Photos/Gallery, select photos, tap **Share → Vault**, and they import + upload.

## Deploy

```powershell
git add .
git commit -m "Gallery import: Photos/Camera picker, HEIC support, Android share target"
git push
```

```bash
cd ~/isync
git pull
docker compose up -d --build
```

> This rebuild installs the HEIC decoder. The app's service worker also changed,
> so installed apps will auto-update on next open.

## Test it ✅

### Picker (Android + iPhone)
1. Open the app, tap **+** → you'll see **Photos & videos** and **Take photo/video**.
2. **Photos & videos** opens your device's gallery → select one or many → they upload.
3. **Take photo/video** opens the camera.

### HEIC (iPhone)
1. From an iPhone, upload a normal photo (iPhones save these as `.heic`).
2. It should show a proper **thumbnail** in the grid and a **preview** when opened
   (not a blank/document icon). Download still gives the exact original.

### Android “Share to Vault”
> Requires the app to be **installed** (Add to Home screen / Install app). Because
> the app's manifest changed, **re-install it once** so Android registers the new
> share option: remove the installed app, reopen the site in Chrome, and Install
> again.
1. Open **Google Photos** (or the Gallery app).
2. Select one or more photos/videos → tap **Share**.
3. In the share sheet, choose **Vault**.
4. Vault opens and the shared items upload automatically.

## Honest platform notes
- **iOS can't add Vault to the Photos share sheet** (Apple doesn't allow web apps
  to be share targets). On iPhone, import using the in-app **Photos & videos**
  button — it opens the same photo library.
- Full-resolution HEIC **preview** uses a high-quality rendered image (since
  browsers like Chrome can't display HEIC directly). The **download** is always
  the untouched, lossless original.

## Troubleshooting
- **“Vault” doesn't appear in the Android share sheet:** re-install the app (the
  manifest changed). Make sure you installed it (not just bookmarked).
- **HEIC photo has no thumbnail:** check `docker compose logs -f app` during
  indexing/upload and send me anything red — some unusual HEIC variants need a tweak.
- **Shared files didn't upload after “Share to Vault”:** open the app once
  normally first (so the new service worker is active), then try sharing again.
