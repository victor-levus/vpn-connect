# VPN Connect

A dashboard showing which peers on your WireGuard VPN are online.

```
React app (Firebase Hosting) ──HTTPS + Firebase ID token──▶ Caddy :443 ──▶ Express API :4807 (VPS)
                                                                            ├─ sudo wg show wg0 dump
                                                                            └─ SQLite via Prisma (names, notes, history)
```

| Folder    | What it is                                         | Deployed to        |
| --------- | -------------------------------------------------- | ------------------ |
| `server/` | Express 5 + Prisma 7 (SQLite) API                  | Interserver VPS    |
| `web/`    | Vite + React + Tailwind v4 + react-icons dashboard | Firebase Hosting   |
| `deploy/` | Setup/update scripts, systemd unit, Caddyfile      | used on the VPS    |

## How "online" works

The API runs `wg show wg0 dump` every 15 s. A peer is **online** if its last handshake was within
**180 s**. When a peer changes between online and offline, the API stores an event, which powers the
activity timeline and the 24 h uptime figure.

> **Every client needs `PersistentKeepalive = 25`** in the `[Peer]` section of *its own* config.
> Without it, an idle but connected peer stops handshaking and will show as offline. The dashboard
> flags peers that have no keepalive set.

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

The script installs Node 24 and Caddy and creates a `wgmon` service user. It also adds a sudoers rule
that allows **only** `wg show wg0 dump`, then sets up the systemd service and Caddy with automatic HTTPS.

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

### Updating later

- **Backend:** push to Git, then on the VPS run `sudo bash /opt/vpn-connect/deploy/update.sh`
- **Frontend:** `cd web && npm run build && firebase deploy --only hosting`

---

## Operations

```bash
journalctl -u vpn-connect -f           # API logs (online/offline changes are logged)
systemctl status vpn-connect caddy
tail -f /var/log/caddy/vpn-api.log     # access log
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
