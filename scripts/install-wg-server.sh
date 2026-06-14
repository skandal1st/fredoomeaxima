#!/usr/bin/env bash
#
# AximaVPN WireGuard node bootstrap (canonical reference).
# Supports Ubuntu 22.04 / 24.04. Run as root.
#
# The panel serves a per-server, token-injected version of this at:
#   GET /servers/<id>/install-script?token=<installToken>
# so admins normally run:
#   curl -fsSL <PANEL_URL>/servers/<id>/install-script?token=<token> | sudo bash
#
# To run manually, export these first:
#   PANEL_URL, SERVER_ID, INSTALL_TOKEN, AGENT_TOKEN
#   WG_PORT (default 51820), WG_ADDRESS (default 10.66.66.1/24), AGENT_PORT (default 8443)
#
set -euo pipefail

: "${PANEL_URL:?PANEL_URL required}"
: "${SERVER_ID:?SERVER_ID required}"
: "${INSTALL_TOKEN:?INSTALL_TOKEN required}"
: "${AGENT_TOKEN:?AGENT_TOKEN required}"
WG_PORT="${WG_PORT:-51820}"
WG_ADDRESS="${WG_ADDRESS:-10.66.66.1/24}"
AGENT_PORT="${AGENT_PORT:-8443}"

echo "[1/8] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y wireguard wireguard-tools ufw curl jq nodejs

echo "[2/8] Enabling IP forwarding..."
cat > /etc/sysctl.d/99-aximavpn.conf <<EOF
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
EOF
sysctl --system

echo "[3/8] Configuring firewall..."
ufw allow 22/tcp || true
ufw allow "${WG_PORT}/udp"
ufw allow "${AGENT_PORT}/tcp"
ufw --force enable || true

echo "[4/8] Generating WireGuard server keys..."
umask 077
mkdir -p /etc/wireguard
if [ ! -f /etc/wireguard/server_private.key ]; then
  wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
fi
SERVER_PRIVATE_KEY="$(cat /etc/wireguard/server_private.key)"
SERVER_PUBLIC_KEY="$(cat /etc/wireguard/server_public.key)"
WAN_IFACE="$(ip route show default | awk '/default/ {print $5; exit}')"

echo "[5/8] Writing wg0 config..."
cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = ${WG_ADDRESS}
ListenPort = ${WG_PORT}
PrivateKey = ${SERVER_PRIVATE_KEY}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o ${WAN_IFACE} -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o ${WAN_IFACE} -j MASQUERADE
EOF

echo "[6/8] Bringing up WireGuard..."
systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0

echo "[7/8] Installing agent..."
mkdir -p /opt/aximavpn-agent
# Prefer the bundle uploaded by the panel's SSH provisioner; otherwise fetch it.
if [ -f /tmp/aximavpn-agent.js ]; then
  cp /tmp/aximavpn-agent.js /opt/aximavpn-agent/agent.js
else
  curl -fsSL "${PANEL_URL}/servers/agent-bundle" -o /opt/aximavpn-agent/agent.js || \
    echo "WARN: could not fetch agent bundle; deploy /opt/aximavpn-agent/agent.js manually"
fi

cat > /etc/aximavpn-agent.env <<EOF
PANEL_URL=${PANEL_URL}
SERVER_ID=${SERVER_ID}
AGENT_TOKEN=${AGENT_TOKEN}
AGENT_PORT=${AGENT_PORT}
WG_INTERFACE=wg0
EOF

cat > /etc/systemd/system/aximavpn-agent.service <<EOF
[Unit]
Description=AximaVPN Agent
After=network-online.target wg-quick@wg0.service

[Service]
EnvironmentFile=/etc/aximavpn-agent.env
ExecStart=/usr/bin/node /opt/aximavpn-agent/agent.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable aximavpn-agent || true
systemctl restart aximavpn-agent || true

echo "[8/8] Registering with panel..."
curl -fsSL -X POST "${PANEL_URL}/servers/${SERVER_ID}/register" \
  -H "Content-Type: application/json" \
  -d "{\"installToken\":\"${INSTALL_TOKEN}\",\"serverPublicKey\":\"${SERVER_PUBLIC_KEY}\"}"

echo ""
echo "Done. Server public key: ${SERVER_PUBLIC_KEY}"
