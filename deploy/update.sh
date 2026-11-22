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

PORT="$(grep -E '^PORT=' "$APP_DIR/server/.env" | cut -d= -f2 | tr -d '"[:space:]')"
PORT="${PORT:-4807}"

echo "==> Restarting service"
systemctl restart vpn-connect

echo "==> Waiting for the API on 127.0.0.1:$PORT"
for i in $(seq 1 30); do
  if journalctl -u vpn-connect --since "-60s" --no-pager -q | grep -q "listening on"; then break; fi
  sleep 1
done
systemctl --no-pager --lines=8 status vpn-connect || true

echo "==> Health check"
BODY="$(curl -sS -w '\n%{http_code}' "http://127.0.0.1:$PORT/api/health" || true)"
CODE="$(tail -n1 <<<"$BODY")"
echo "$(head -n -1 <<<"$BODY")"
if [[ "$CODE" == 200 ]] && grep -q '"ok":true' <<<"$BODY"; then
  echo "API is healthy."
else
  echo "Health check failed (HTTP $CODE). Something else may be using port $PORT:"
  ss -ltnp "sport = :$PORT" || true
  exit 1
fi
