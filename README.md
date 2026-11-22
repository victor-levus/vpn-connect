# VPN Connect

A dashboard showing which peers on your WireGuard VPN are online.

```
React app (Firebase Hosting) ──HTTPS + Firebase ID token──▶ nginx :443 ──▶ Express API :4807 (VPS)
                                                                            ├─ sudo wg show wg0 dump
                                                                            └─ SQLite via Prisma (names, notes, history)
```

| Folder    | What it is                                         | Deployed to        |
| --------- | -------------------------------------------------- | ------------------ |
| `server/` | Express 5 + Prisma 7 (SQLite) API                  | Interserver VPS    |
| `web/`    | Vite + React + Tailwind v4 + react-icons dashboard | Firebase Hosting   |
| `deploy/` | Setup/update scripts, systemd unit, nginx/Caddy conf | used on the VPS    |

## How "online" works

The API runs `wg show wg0 dump` every **5 s**. A peer is **online** when both of these are true:

1. Its last handshake was within **180 s**. WireGuard re-handshakes about every 2 minutes, so this
   alone is too slow to notice a client going away.
2. Its *received bytes* counter grew within the last **40 s**. This is what makes detection fast. With
   `PersistentKeepalive = 25`, a connected client sends at least one packet every 25 s even when idle,
   so the counter only stops when the client is gone.

A switched-off client therefore shows **offline within about 40–45 s**. To tune this, set
`POLL_INTERVAL_SECONDS` and `ACTIVITY_TIMEOUT_SECONDS` in `server/.env`. Keep the timeout above
keepalive + poll interval + a few seconds of slack. For example, a client keepalive of 10 allows a
timeout of 20.

When a peer changes between online and offline, the API stores an event, which powers the activity
timeline and the 24 h uptime figure.

> **Every client needs `PersistentKeepalive = 25`** (or lower) in the `[Peer]` section of *its own*
> config. Without it, an idle but connected client sends nothing and will be shown as offline. The
> dashboard flags peers whose handshake is current but that have gone quiet.

**Peer names:** WireGuard only knows public keys. Click a peer in the dashboard to give it a name and
notes. Names are stored in SQLite and survive restarts. (Alternatively, set `WG_CONFIG_PATH` to read
`# Name: laptop` comments from a WireGuard config. Only do this if the `wgmon` user can read the file,
and keep in mind that `wg0.conf` contains the server's private key.)

---

## Local development (no WireGuard or Firebase needed)

```bash
# Terminal 1: API with fake peers and auth disabled
cd server
cp .env.example .env          # then set WG_MOCK=true, AUTH_DISABLED=true, WG_USE_SUDO=false
npm install
npx prisma migrate dev
npm run dev                   # http://127.0.0.1:4807/api/health

# Terminal 2: dashboard
cd web
npm install
# .env.development.local with VITE_AUTH_DISABLED=true skips Google login
npm run dev                   # http://localhost:5173
```

Vite proxies `/api` to the local API in development, so `VITE_API_URL` stays empty.

---

## Deploying

### 1. Firebase project (once)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → Google → Enable.**
3. **Project settings → Your apps → Add web app.** Copy the config values.
4. Install the CLI: `npm install -g firebase-tools`, then `firebase login`.

### 2. DNS (once)

Add an **A record** for your API subdomain, for example `vpn-api.yourdomain.com`, pointing at the
VPS public IP. Wait until `nslookup vpn-api.yourdomain.com` returns the VPS IP.

### 3. Push this repo to GitHub (or any Git host)

The VPS pulls code with `git`. For a private repo, add a
[deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)
on the VPS, or use an HTTPS URL with a read-only token.

### 4. Backend on the VPS (Ubuntu)

```bash
ssh root@your-vps
curl -fsSLO https://raw.githubusercontent.com/<you>/vpn-connect/main/deploy/setup-vps.sh   # or scp it
sudo bash setup-vps.sh vpn-api.yourdomain.com <git-repo-url> wg0
```

The script installs Node 24 and creates a `wgmon` service user. It also adds a sudoers rule
that allows **only** `wg show wg0 dump`, then sets up the systemd service and HTTPS. If nginx is
already running (as on the Interserver VPS), it adds an nginx site and runs certbot. Otherwise it uses Caddy.

Next, edit `/opt/vpn-connect/server/.env`:

```ini
FIREBASE_PROJECT_ID=your-project-id
ALLOWED_EMAILS=you@gmail.com
CORS_ORIGINS=https://your-project-id.web.app,https://your-project-id.firebaseapp.com
```

Then build and start:

```bash
sudo bash /opt/vpn-connect/deploy/update.sh
curl https://vpn-api.yourdomain.com/api/health      # → {"ok":true,...}
```

**Firewall:** ports **80** and **443** (TCP) must be open, for Let's Encrypt and the API. If you use
`ufw`, run `ufw allow 80/tcp && ufw allow 443/tcp`. Also check Interserver's control panel firewall, if
you use one. The API itself listens only on `127.0.0.1:4807`.

### 5. Frontend to Firebase Hosting

```bash
cd web
cp .env.example .env.production     # fill in VITE_API_URL=https://vpn-api.yourdomain.com and the Firebase config
firebase use --add                  # pick your project
npm run build
firebase deploy --only hosting
```

Open `https://<project>.web.app` and sign in with the Google account in `ALLOWED_EMAILS`.

### Updating later (automatic)

Pushing to `main` deploys whatever changed, using GitHub Actions:

| Workflow                                   | Runs when these change              | What it does                                                          |
| ------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------- |
| `.github/workflows/deploy-backend.yml`     | `server/**`, `deploy/**`            | Builds in CI, SSHes to the VPS to run `update.sh`, checks the public health URL |
| `.github/workflows/deploy-web.yml`         | `web/**`                            | Builds the dashboard and deploys it to Firebase Hosting               |

Both can also be started by hand: **GitHub → Actions → the workflow → Run workflow**.

**What the workflows need in GitHub (Settings → Secrets and variables → Actions):**

| Name                         | Kind     | Value                                                         |
| ---------------------------- | -------- | ------------------------------------------------------------- |
| `VPS_HOST`                   | secret   | VPS IP address                                                |
| `VPS_SSH_KEY`                | secret   | Private deploy key (ed25519, no passphrase)                    |
| `VPS_KNOWN_HOSTS`            | secret   | Output of `ssh-keyscan <VPS IP>`                              |
| `FIREBASE_SERVICE_ACCOUNT`   | secret   | JSON key of a service account with *Firebase Hosting Admin* and *API Keys Viewer* |
| `VITE_API_URL`, `VITE_FIREBASE_*` | variable | Same values as `web/.env.example`                        |

**The deploy key on the VPS is locked down.** Its line in `/root/.ssh/authorized_keys` uses
`command="/usr/bin/bash /opt/vpn-connect/deploy/update.sh",restrict`. Whatever command GitHub sends,
that key can only run the update script: no shell and no port forwarding.

> Anyone who can push to `main` can change what `update.sh` runs as root on the VPS. Keep
> two-factor authentication on the GitHub account, and don't give others write access to the repo.

**Manual fallback:** on the VPS run `sudo bash /opt/vpn-connect/deploy/update.sh`. Locally,
`cd web && npm run build && firebase deploy --only hosting`.

---

## Operations

```bash
journalctl -u vpn-connect -f           # API logs (online/offline changes are logged)
systemctl status vpn-connect nginx
tail -f /var/log/nginx/access.log      # access log
```

**Backups:** everything the app owns is in `/opt/vpn-connect/server/data/vpn.db`.

## Security model

- The API is public on HTTPS, but every route except `/api/health` requires a Firebase ID token.
  The token must belong to a **verified** email listed in `ALLOWED_EMAILS`.
- The Firebase web config in the frontend is public by design. Access control happens on the backend.
- The service runs as the unprivileged `wgmon` user. Its only elevated permission is `wg show wg0 dump`.
- The WireGuard private key and preshared keys are dropped while the dump is parsed and are never
  stored or sent.
- The API applies CORS (only your Firebase origins), helmet headers, rate limiting (600 requests per
  15 min per IP) and input validation.

## API

| Method | Path                       | Description                                    |
| ------ | -------------------------- | ---------------------------------------------- |
| GET    | `/api/health`              | Unauthenticated liveness check                 |
| GET    | `/api/me`                  | The signed-in user                             |
| GET    | `/api/snapshot`            | Server info and all peers with status          |
| GET    | `/api/stream`              | Server-Sent Events, a `snapshot` after every poll |
| PATCH  | `/api/peers/:key`          | `{ name?, notes? }`. The key is base64url      |
| GET    | `/api/peers/:key/history`  | Last 50 status changes and 24 h uptime         |
