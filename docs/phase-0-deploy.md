# Phase 0 — Deploy Guide (get `https://yourdomain` live)

Goal: a secure placeholder page running on your VPS. This proves the whole
pipeline works before we build features.

You'll do four parts:
- **A.** Push the code to GitHub (from your Windows computer)
- **B.** Point your domain at the VPS (DNS)
- **C.** Run it on the VPS (Docker)
- **D.** Verify

Replace these placeholders wherever you see them:
- `YOURDOMAIN` → your real domain (e.g. `photos.mydomain.com`)
- `YOUR_VPS_IP` → your VPS's public IP address
- `YOUR_GH_USERNAME` / `YOUR_REPO` → your GitHub username + repo name

---

## Part A — Push the code to GitHub (run on your Windows PC, in PowerShell)

1. Go to <https://github.com/new> and create a new repository:
   - Name: `vault` (or anything you like)
   - Visibility: **Private**
   - **Do NOT** check "Add a README" / .gitignore / license (we already have them)
   - Click **Create repository**

2. Back in this project folder, run these commands (PowerShell):

   ```powershell
   git add .
   git commit -m "Phase 0: foundation + automatic HTTPS"
   git remote add origin https://github.com/YOUR_GH_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

   The first push opens a browser to log into GitHub (or asks for a token).
   Follow the prompts — it's a one-time thing.

> ✅ When this works, refreshing your GitHub repo page shows all the files.

---

## Part B — Point your domain at the VPS (DNS)

1. Log into wherever you bought your domain (your registrar's website).
2. Find the **DNS** / **DNS records** settings.
3. Add an **A record**:

   | Field | Value |
   |-------|-------|
   | Type  | `A` |
   | Name / Host | `@` for the root domain, **or** a subdomain like `photos` |
   | Value / Points to | `YOUR_VPS_IP` |
   | TTL | leave default (or lowest available) |

4. Save. DNS can take a few minutes (sometimes up to an hour) to take effect.

> Tip: if you use a subdomain like `photos`, your site will be at
> `https://photos.mydomain.com`. Whatever you pick here must match the
> `DOMAIN` value you set in Part C.

---

## Part C — Run it on the VPS (via SSH)

SSH into your VPS, then:

### 1. Install Docker (one time)

```bash
curl -fsSL https://get.docker.com | sudo sh
```

This installs Docker + the Compose plugin. Verify:

```bash
docker --version
docker compose version
```

### 2. Open the firewall for web traffic (if a firewall is active)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

(If `ufw` says "command not found", you likely have no firewall blocking these — that's fine, skip it.)

### 3. Get the code from GitHub

```bash
# Install git if needed:
sudo apt-get update && sudo apt-get install -y git

# Clone YOUR repo (use the same URL as Part A):
git clone https://github.com/YOUR_GH_USERNAME/YOUR_REPO.git vault
cd vault
```

### 4. Create your settings file

```bash
cp .env.example .env
nano .env
```

In the editor, set your real values:

```
DOMAIN=YOURDOMAIN
ACME_EMAIL=you@example.com
```

Save and exit nano: press `Ctrl+O`, `Enter`, then `Ctrl+X`.

### 5. Start it

```bash
docker compose up -d
```

Check it's running and watch Caddy get your HTTPS certificate:

```bash
docker compose logs -f caddy
```

Look for a line mentioning `certificate obtained successfully`. Press `Ctrl+C`
to stop watching the logs (the app keeps running).

---

## Part D — Verify ✅

On your **phone** (or any browser), open:

```
https://YOURDOMAIN
```

You should see the **"Your Vault is being built"** page with a **padlock** in
the address bar. That means Phase 0 is complete: domain, HTTPS, Docker, and
Caddy all work.

---

## Handy commands (for later)

```bash
docker compose ps            # see what's running
docker compose logs -f       # watch logs
docker compose down          # stop everything
docker compose up -d         # start everything
git pull && docker compose up -d --build   # update after we push new code
```

## If something's not right

- **Browser says "not secure" / no padlock:** DNS may not have propagated yet,
  or the A record points to the wrong IP. Recheck Part B and wait a few minutes.
- **`certificate` errors in the logs:** make sure ports 80 and 443 are open
  (Part C step 2) and that no other web server (Apache/Nginx) is already using
  them. Stop those first if so.
- **Anything else:** copy the output of `docker compose logs caddy` and send it
  to me — I'll diagnose it.
```
