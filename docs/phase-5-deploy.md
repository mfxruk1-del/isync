# Phase 5 — Multi-user accounts (invite-based) — Deploy & Test

Family & friends can now have their **own private libraries** and their **own
share links**. Accounts are **invite-only** (no open sign-ups), so nobody random
can register. No new settings.

## How it works
- You (the owner) are now an **admin**.
- Admins generate **invite links** and send them to people.
- An invited person opens the link, picks a username + password, and gets their
  own empty, private library.
- Each user only ever sees their own files and makes their own shares — the data
  was already separated by owner, so there's no mixing.

## Deploy

```powershell
# on your PC
git add .
git commit -m "Phase 5: multi-user accounts via invite links"
git push
```

```bash
# on your VPS
cd ~/isync
git pull
docker compose up -d --build
```

> On startup the app automatically upgrades your existing account to **admin**
> and migrates the database (adds the new columns/tables). Your existing photos
> and shares are untouched.

## Test it ✅
1. Log in as yourself — you'll now see a **“People”** button (admins only).
2. Click **People → “+ New invite link”**, then **Copy** the link.
3. Open that link in an **incognito window** (or send it to a phone):
   - You'll get a **“Create your account”** page.
   - Pick a username + password (8+ chars) → you're signed in with an **empty**
     library.
4. As that new user, upload a photo and create a share link — confirm you do
   **not** see the owner's photos.
5. Back as admin, open **People** again — you'll see the new member listed with
   their item count, and the invite now shows as used.
6. Generate another invite and **Revoke** it before use — the link stops working.

## Notes
- Invite links are single-use and unguessable.
- The owner account is always an admin (set from your `.env` username).
- Invited users are regular (non-admin) members; they can't invite others.
- Want admins to be able to remove a member (and their files) from the UI? That's
  a small add-on — just ask.
```
