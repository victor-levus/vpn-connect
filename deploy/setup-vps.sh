#!/usr/bin/env bash
# One-time setup of the VPN Connect API on an Ubuntu VPS that already runs WireGuard.
#
# Usage (as root):
#   bash setup-vps.sh <api-domain> <git-repo-url> [wg-interface]
# Example:
#   bash setup-vps.sh vpn-api.yourdomain.com https://github.com/you/vpn-connect.git wg0
#
# Safe to re-run: every step checks whether it has already been done.
set -euo pipefail

API_DOMAIN="${1:?usage: setup-vps.sh <api-domain> <git-repo-url> [wg-interface]}"
REPO_URL="${2:?usage: setup-vps.sh <api-domain> <git-repo-url> [wg-interface]}"
WG_IFACE="${3:-wg0}"
APP_DIR=/opt/vpn-connect
APP_USER=wgmon

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo bash $0 ...)"; exit 1; }
command -v wg >/dev/null || { echo "wireguard-tools not found (wg). Is WireGuard installed?"; exit 1; }
wg show "$WG_IFACE" >/dev/null || { echo "WireGuard interface $WG_IFACE not found. Check 'wg show'."; exit 1; }
WG_BIN="$(command -v wg)"

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

step "Installing base packages"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https build-essential python3

step "Installing Node.js 24 LTS (if needed)"
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
node -v

# If nginx already serves other sites on 80/443, add the API as an nginx site (certbot for HTTPS).
# Otherwise use Caddy, which handles HTTPS by itself.
if systemctl is-active --quiet nginx; then PROXY=nginx; else PROXY=caddy; fi
echo "Reverse proxy: $PROXY"

if [[ $PROXY == caddy ]] && ! command -v caddy >/dev/null; then
  step "Installing Caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

step "Creating service user $APP_USER"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

step "Fetching the code into $APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
mkdir -p "$APP_DIR/server/data"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
git config --system --add safe.directory "$APP_DIR" || true

step "Allowing $APP_USER to run 'wg show $WG_IFACE dump' (and nothing else)"
SUDOERS=/etc/sudoers.d/vpn-connect
echo "$APP_USER ALL=(root) NOPASSWD: $WG_BIN show $WG_IFACE dump" > "$SUDOERS.tmp"
chmod 0440 "$SUDOERS.tmp"
visudo -cf "$SUDOERS.tmp"
mv "$SUDOERS.tmp" "$SUDOERS"
sudo -u "$APP_USER" sudo -n "$WG_BIN" show "$WG_IFACE" dump >/dev/null && echo "wg access OK"

step "Creating server/.env (if missing)"
ENV_FILE="$APP_DIR/server/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  sed -e "s|^NODE_ENV=.*|NODE_ENV=production|" \
      -e "s|^WG_INTERFACE=.*|WG_INTERFACE=$WG_IFACE|" \
      -e "s|^WG_BIN=.*|WG_BIN=$WG_BIN|" \
      -e "s|^WG_USE_SUDO=.*|WG_USE_SUDO=true|" \
      -e "s|^WG_MOCK=.*|WG_MOCK=false|" \
      -e "s|^AUTH_DISABLED=.*|AUTH_DISABLED=false|" \
      "$APP_DIR/server/.env.example" > "$ENV_FILE"
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  NEED_ENV_EDIT=1
fi

step "Installing systemd unit"
sed -e "s|wg-quick@wg0|wg-quick@$WG_IFACE|" "$APP_DIR/deploy/vpn-connect.service" > /etc/systemd/system/vpn-connect.service
systemctl daemon-reload
systemctl enable vpn-connect

if [[ $PROXY == nginx ]]; then
  step "Adding nginx site for $API_DOMAIN"
  command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
  SITE=/etc/nginx/sites-available/vpn-connect
  if [[ ! -f $SITE ]]; then
    sed "s|vpn-api.example.com|$API_DOMAIN|" "$APP_DIR/deploy/nginx-vpn-api.conf" > "$SITE"
    ln -sf "$SITE" /etc/nginx/sites-enabled/vpn-connect
  fi
  nginx -t
  systemctl reload nginx
  step "Getting an HTTPS certificate for $API_DOMAIN"
  certbot --nginx -d "$API_DOMAIN" --redirect --keep-until-expiring
else
  step "Configuring Caddy for $API_DOMAIN"
  sed "s|vpn-api.example.com|$API_DOMAIN|" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile
  systemctl enable caddy
  systemctl reload caddy || systemctl restart caddy
fi

if [[ "${NEED_ENV_EDIT:-0}" == 1 ]]; then
  cat <<EOF

────────────────────────────────────────────────────────────────────
Almost done. Edit $ENV_FILE and set:
  FIREBASE_PROJECT_ID   your Firebase project ID
  ALLOWED_EMAILS        your Google account email
  CORS_ORIGINS          https://<project>.web.app,https://<project>.firebaseapp.com
Then run:
  sudo bash $APP_DIR/deploy/update.sh
────────────────────────────────────────────────────────────────────
EOF
else
  bash "$APP_DIR/deploy/update.sh"
fi
