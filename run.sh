#!/bin/bash

# ── Resume Studio Run Script ──────────────────────────────────────────────────
# This script automates the environment setup and starts the visual builder.

# Background Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "  ▶  RESUME STUDIO ULTIMATE  ◀  "
echo "───────────────────────────────"
echo -e "${NC}"

# 1. Check Python installation
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Error: python3 is not installed.${NC}"
    echo "Please install it: sudo apt update && sudo apt install python3"
    exit 1
fi

# 2. Check for python3-venv (Common issue on Ubuntu/Debian)
if ! python3 -m venv --help &> /dev/null; then
    echo -e "${YELLOW}⚠️  Missing python3-venv. Attempting to install...${NC}"
    if command -v apt &> /dev/null; then
        sudo apt update && sudo apt install -y python3-venv
    else
        echo -e "${RED}❌ Could not install python3-venv automatically.${NC}"
        echo "Please install it manually for your distribution."
        exit 1
    fi
fi

# 3. Virtual Environment Setup
if [ ! -d "venv" ]; then
    echo -e "${BLUE}📦 Creating virtual environment...${NC}"
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to create virtual environment.${NC}"
        exit 1
    fi
fi

# 4. Activate Venv
source venv/bin/activate
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to activate virtual environment.${NC}"
    exit 1
fi

# 5. Install/Update Dependencies
echo -e "${BLUE}📥 Checking dependencies...${NC}"
pip install --upgrade pip
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies.${NC}"
    exit 1
fi

# 6. Final Launch
echo -e "${GREEN}✅ Environment Ready${NC}"
echo ""
echo -e "${YELLOW}🚀 Starting Resume VISUAL BUILDER...${NC}"
echo -e "👉 Open: ${CYAN}http://127.0.0.1:5051${NC}"
echo ""

# Run uvicorn
uvicorn app:app --host 127.0.0.1 --port 5051 --reload
