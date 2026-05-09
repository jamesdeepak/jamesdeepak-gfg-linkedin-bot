#!/bin/bash

# GFG LinkedIn Bot — Mac/Linux Launcher

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo ""
echo -e "${CYAN}  ============================================"
echo "    GFG LinkedIn Bot — Starting..."
echo -e "  ============================================${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}  [ERROR] Node.js is not installed!${NC}"
    echo ""
    echo "  Install it from: https://nodejs.org (download LTS)"
    echo "  Or on Mac with Homebrew: brew install node"
    echo ""
    open "https://nodejs.org" 2>/dev/null || xdg-open "https://nodejs.org" 2>/dev/null
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}  [WARN] Node.js version is too old. Need v18+. Current: $(node --version)${NC}"
    echo "  Download newer version from https://nodejs.org"
    exit 1
fi

echo -e "  ${GREEN}✓${NC} Node.js $(node --version) detected"

# First-time setup
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "  ${YELLOW}[SETUP] First time — installing dependencies...${NC}"
    npm install
    echo ""
    echo -e "  ${YELLOW}[SETUP] Installing Chromium browser (one-time)...${NC}"
    npx playwright install chromium
    echo ""
    echo -e "  ${GREEN}✓ Setup complete!${NC}"
fi

# Create .env from example if missing
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "  ${YELLOW}[INFO] Created .env — fill in your credentials in the dashboard.${NC}"
fi

echo ""
echo -e "  ${GREEN}[OK] Starting GFG Bot...${NC}"
echo -e "  ${GREEN}[OK] Dashboard → http://localhost:3000${NC}"
echo ""
echo "  Keep this window open while the bot is running."
echo "  Press Ctrl+C to stop."
echo ""

# Open browser after 2s
(sleep 2 && (open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null)) &

# Start server
node src/server.js
