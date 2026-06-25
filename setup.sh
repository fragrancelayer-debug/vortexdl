#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  VortexDL — Setup Script
#  Run this once before starting the app for the first time.
# ─────────────────────────────────────────────────────────────

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

print() { echo -e "${CYAN}${BOLD}[VortexDL]${RESET} $1"; }
ok()    { echo -e "${GREEN}✓${RESET} $1"; }
warn()  { echo -e "${YELLOW}⚠${RESET} $1"; }
err()   { echo -e "${RED}✗${RESET} $1"; }

echo ""
echo -e "${BOLD}${CYAN}  ██╗   ██╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗${RESET}"
echo -e "${BOLD}${CYAN}  ██║   ██║██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝${RESET}"
echo -e "${BOLD}${CYAN}  ██║   ██║██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝ ${RESET}"
echo -e "${BOLD}${CYAN}  ╚██╗ ██╔╝██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗ ${RESET}"
echo -e "${BOLD}${CYAN}   ╚████╔╝ ╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗${RESET}"
echo -e "${BOLD}${CYAN}    ╚═══╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝${RESET}"
echo ""
echo -e "  ${BOLD}Universal Video Downloader — Setup${RESET}"
echo ""

# ── 1. Check Node.js ────────────────────────────────────────────────────────
print "Checking Node.js..."
if ! command -v node &>/dev/null; then
  err "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
  exit 1
fi
NODE_VER=$(node -v)
ok "Node.js $NODE_VER found"

# ── 2. Check Python / pip ───────────────────────────────────────────────────
print "Checking Python..."
if command -v python3 &>/dev/null; then
  ok "Python3 found: $(python3 --version)"
  PY=python3
elif command -v python &>/dev/null; then
  ok "Python found: $(python --version)"
  PY=python
else
  warn "Python not found — yt-dlp install will be skipped. Install Python 3 and then run: pip install yt-dlp"
  PY=""
fi

# ── 3. Install / upgrade yt-dlp ─────────────────────────────────────────────
if [ -n "$PY" ]; then
  print "Installing / upgrading yt-dlp..."
  if command -v pip3 &>/dev/null; then
    pip3 install --upgrade yt-dlp 2>&1 | tail -1
    ok "yt-dlp installed: $(yt-dlp --version 2>/dev/null || echo 'check PATH')"
  elif command -v pip &>/dev/null; then
    pip install --upgrade yt-dlp 2>&1 | tail -1
    ok "yt-dlp installed"
  else
    warn "pip not found. Install yt-dlp manually: pip install yt-dlp"
  fi
fi

# Also try pipx fallback
if ! command -v yt-dlp &>/dev/null; then
  if command -v brew &>/dev/null; then
    print "Trying brew install yt-dlp..."
    brew install yt-dlp 2>&1 | tail -1 && ok "yt-dlp installed via brew"
  fi
fi

# ── 4. Check ffmpeg ─────────────────────────────────────────────────────────
print "Checking ffmpeg..."
if command -v ffmpeg &>/dev/null; then
  ok "ffmpeg found ($(ffmpeg -version 2>&1 | head -1 | cut -d' ' -f3))"
else
  warn "ffmpeg not found. Some quality merging may not work."
  echo "  Install: brew install ffmpeg  OR  sudo apt install ffmpeg"
fi

# ── 5. Install Node packages ─────────────────────────────────────────────────
print "Installing Node packages..."
npm install
ok "Node packages installed"

# ── 6. Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ✓ Setup complete!${RESET}"
echo ""
echo -e "  Run the app:"
echo -e "  ${CYAN}npm run dev${RESET}  →  http://localhost:3000"
echo ""
