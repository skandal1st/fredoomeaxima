#!/usr/bin/env bash
#
# AximaVPN panel deployment for a fresh Ubuntu 22.04/24.04 VPS.
# Installs Docker, opens the firewall, and brings up the full stack behind
# Traefik with Let's Encrypt TLS.
#
# Run as root from the repo root, AFTER:
#   1) pointing your domain's DNS A record at this VPS,
#   2) creating .env (copy from .env.production.example and fill the secrets).
#
# Usage:  sudo bash scripts/deploy-panel.sh
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.production.example to .env and fill in the values." >&2
  exit 1
fi

echo "[1/4] Installing Docker (if needed)..."
if ! command -v docker >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "[2/4] Configuring firewall..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw allow 51820/udp || true   # WireGuard (co-located first node)
  ufw allow 8443/tcp || true    # agent API (restrict to panel IP in multi-host setups)
  ufw --force enable || true
fi

echo "[3/4] Building and starting the stack..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "[4/4] Seeding the database (idempotent)..."
# Give the API a moment to apply migrations on first boot.
sleep 10
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T api npx prisma db seed || \
  echo "Seed step skipped/failed — run it manually once the API is healthy."

echo ""
echo "Done. Open https://${PANEL_DOMAIN:-your-domain} (TLS may take ~30s on first issue)."
echo "Sign in with ADMIN_EMAIL / ADMIN_PASSWORD from .env."
