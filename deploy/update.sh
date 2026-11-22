#!/usr/bin/env bash
# Pull the latest code, build, migrate the database and restart the API.
# Usage (as root, on the VPS):  sudo bash /opt/vpn-connect/deploy/update.sh
set -euo pipefail

APP_DIR=/opt/vpn-connect
APP_USER=wgmon
as_app() { sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR/server' && $*"; }

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo bash $0)"; exit 1; }

echo "==> Pulling latest code"
sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only

echo "==> Installing dependencies"
as_app "npm ci --no-audit --no-fund"

echo "==> Building"
as_app "npm run build"

echo "==> Applying database migrations"
as_app "npm run db:deploy"

echo "==> Restarting service"
systemctl restart vpn-connect
sleep 3
systemctl --no-pager --lines=5 status vpn-connect || true

echo "==> Health check"
curl -fsS http://127.0.0.1:4000/api/health && echo
