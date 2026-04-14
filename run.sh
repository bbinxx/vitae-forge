#!/bin/bash

# ── RESUME ULTIMATE CONTROL CENTER ───────────────────────────────────────────
# Unified Entry Point for Building, Deploying, and Managing Resumes
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")"
ROOT=$(pwd)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Setup Virtual Environment
setup_env() {
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}📦 Creating virtual environment...${NC}"
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    else
        source venv/bin/activate
    fi
}

show_header() {
    clear
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}             RESUME STUDIO ULTIMATE CONTROL CENTER             ${NC}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

show_menu() {
    echo -e "${BOLD}MAIN MENU${NC}"
    echo -e "  [1] 🚀 Start Web Studio (FastAPI Dashboard)"
    echo -e "  [2] 🏗️  Build All Resumes (Standard + Photo)"
    echo -e "  [3] 🎯 Build Specific Role"
    echo -e "  [4] 🧹 Clean Build Artifacts (dist/logs)"
    echo -e "  [5] ☁️  Sync to Cloud (R2 Upload)"
    echo -e "  [6] 🏷️  Tag Version & Git Push"
    echo -e "  [0] 🚪 Exit"
    echo ""
    echo -ne "${BOLD}Select an option: ${NC}"
}

run_studio() {
    echo -e "${GREEN}🚀 Starting Studio at http://127.0.0.1:5050...${NC}"
    uvicorn src.studio:app --host 127.0.0.1 --port 5050 --reload
}

run_build_all() {
    echo -e "${GREEN}🏗️  Building all variants...${NC}"
    bash src/build.sh
    echo -e "\n${GREEN}✅ Build complete. Check dist/ folder.${NC}"
    read -p "Press Enter to continue..."
}

run_build_role() {
    # Get available roles from config
    ROLES=$(python3 -c "import json; d=json.load(open('configs/resume_config.json')); print(*(d['recipes'].keys()))")
    echo -e "${BLUE}Available roles:${NC} $ROLES"
    echo -ne "${BOLD}Enter Role ID: ${NC}"
    read ROLE_ID
    if [ -n "$ROLE_ID" ]; then
        bash src/build.sh "$ROLE_ID"
    else
        echo -e "${RED}Invalid Role ID.${NC}"
    fi
    read -p "Press Enter to continue..."
}

run_clean() {
    echo -e "${YELLOW}🧹 Cleaning...${NC}"
    bash src/build.sh clean
    echo -e "${GREEN}✅ Cleaned.${NC}"
    read -p "Press Enter to continue..."
}

run_sync() {
    echo -e "${BLUE}☁️  Syncing to R2...${NC}"
    python3 src/upload_r2.py
    echo -e "${GREEN}✅ Sync complete.${NC}"
    read -p "Press Enter to continue..."
}

run_tag() {
    echo -ne "${BOLD}Enter Version (e.g., 1.0.0): ${NC}"
    read VERSION
    if [ -n "$VERSION" ]; then
        bash src/tag_version.sh "$VERSION"
    else
        echo -e "${RED}Version cannot be empty.${NC}"
    fi
    read -p "Press Enter to continue..."
}

# Main Loop
setup_env

while true; do
    show_header
    show_menu
    read -r opt
    case $opt in
        1) run_studio ;;
        2) run_build_all ;;
        3) run_build_role ;;
        4) run_clean ;;
        5) run_sync ;;
        6) run_tag ;;
        0) echo -e "${CYAN}Goodbye!${NC}"; exit 0 ;;
        *) echo -e "${RED}Invalid option!${NC}"; sleep 1 ;;
    esac
done
