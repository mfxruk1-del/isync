# Vault — Self-Hosted Lossless Media Vault (PWA)

A private, self-hosted cloud for photos and videos for family & friends, with:

- **True lossless storage** — files are stored byte-for-byte and served back unchanged. A SHA-256 checksum proves every download is identical to the original.
- **Selective share links** — pick specific items, share a link that previews *only those*, with lossless download.
- **Installable PWA** — works on iPhone, Android, and desktop from one codebase.

Runs entirely on your own Linux VPS via Docker. HTTPS is automatic (Caddy).

---

## Build roadmap

| Phase | What it delivers | Status |
|-------|------------------|--------|
| **0** | Foundation: secure `https://yourdomain` live. | ✅ |
| **1** | Lossless image upload + download, gallery, owner login, installable PWA. | ✅ |
| **2** | Selective share links (+ expiry + password). | ✅ |
| **3** | Video support with resumable (tus) uploads. | ✅ |
| **4** | Public install prompt + open-in-app link capturing. | ✅ |
| **5** | Multi-user accounts via invite links. | ✅ |
| — | Automated off-site backups. | ⏸️ deferred |

Full details: `../.claude/plans/i-want-to-build-steady-cook.md`

---

## Project layout

```
docker-compose.yml   # runs the whole app
Caddyfile            # HTTPS + routing (reads domain from .env)
.env                 # your private settings (NOT committed) — copy from .env.example
placeholder/         # Phase 0 static placeholder page
data/                # your real files + database (NOT committed) — created on the VPS
```

---

## Running it (Phase 0)

See `docs/phase-0-deploy.md` for exact, copy-paste steps.

Quick version (on the VPS, inside this folder):

```bash
cp .env.example .env      # then edit .env with your real domain + email
docker compose up -d      # start everything
```

Then open `https://yourdomain` — you should see a secure placeholder page.
