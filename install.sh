#!/usr/bin/env bash
# dnsmasq Manager – one-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/jbfishnet/dnsUI/main/install.sh | bash
set -euo pipefail

REPO_URL="https://github.com/jbfishnet/dnsUI.git"
INSTALL_DIR="${DNSUI_DIR:-$HOME/dnsUI}"
HTTPS_PORT="${HTTPS_PORT:-9123}"
HTTP_PORT="${HTTP_PORT:-9180}"
BACKEND_PORT="${BACKEND_PORT:-9124}"

# ── colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[dnsUI]${NC} $*"; }
ok()    { echo -e "${GREEN}[dnsUI]${NC} $*"; }
warn()  { echo -e "${YELLOW}[dnsUI]${NC} $*"; }
die()   { echo -e "${RED}[dnsUI] ERROR:${NC} $*" >&2; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       dnsmasq Manager Installer      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── 1. OS check ──────────────────────────────────────────────────────────────
if [[ "$(uname -s)" != "Linux" ]]; then
  die "This installer targets Linux only (Raspberry Pi OS / Debian / Ubuntu)."
fi

# ── 2. dnsmasq ───────────────────────────────────────────────────────────────
info "Checking dnsmasq..."
if ! command -v dnsmasq &>/dev/null; then
  warn "dnsmasq not found. Installing..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq dnsmasq
fi
if ! systemctl is-active --quiet dnsmasq; then
  warn "dnsmasq is not running. Starting it now..."
  sudo systemctl enable --now dnsmasq
fi
ok "dnsmasq is active."

# ── 3. /etc/dnsmasq.conf ─────────────────────────────────────────────────────
if [[ ! -f /etc/dnsmasq.conf ]]; then
  warn "/etc/dnsmasq.conf not found. Creating a minimal one..."
  sudo tee /etc/dnsmasq.conf >/dev/null <<'EOF'
# dnsmasq configuration – managed by dnsmasq Manager
domain-needed
bogus-priv
EOF
fi
ok "/etc/dnsmasq.conf present."

# ── 4. Docker ────────────────────────────────────────────────────────────────
info "Checking Docker..."
if ! command -v docker &>/dev/null; then
  warn "Docker not found. Installing via get.docker.com..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  warn "You have been added to the 'docker' group."
  warn "You may need to log out and back in before running Docker without sudo."
fi
ok "Docker found: $(docker --version)"

# ── 5. Docker Compose v2 ─────────────────────────────────────────────────────
info "Checking Docker Compose..."
if ! docker compose version &>/dev/null 2>&1; then
  warn "Docker Compose v2 not found. Installing docker-compose-plugin..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-compose-plugin
fi
ok "Docker Compose found: $(docker compose version)"

# ── 6. git ───────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  warn "git not found. Installing..."
  sudo apt-get update -qq && sudo apt-get install -y -qq git
fi

# ── 7. Clone or update repo ──────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Repository already exists at $INSTALL_DIR — pulling latest..."
  git -C "$INSTALL_DIR" pull
else
  info "Cloning repository to $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# ── 8. Build and start ───────────────────────────────────────────────────────
info "Building containers (this may take a few minutes on first run)..."
HTTPS_PORT="$HTTPS_PORT" HTTP_PORT="$HTTP_PORT" BACKEND_PORT="$BACKEND_PORT" \
  docker compose -f "$INSTALL_DIR/docker-compose.yml" up -d --build

# ── 9. Done ──────────────────────────────────────────────────────────────────
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
echo ""
ok "Installation complete!"
echo ""
echo -e "  Web UI:  ${CYAN}https://${LOCAL_IP}:${HTTPS_PORT}${NC}"
echo -e "           (accept the self-signed certificate warning)"
echo ""
echo -e "  Manage:  ${CYAN}cd $INSTALL_DIR && docker compose logs -f${NC}"
echo -e "  Update:  ${CYAN}cd $INSTALL_DIR && git pull && docker compose up -d --build${NC}"
echo ""
