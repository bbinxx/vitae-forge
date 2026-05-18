#!/bin/bash

# ── RESUME ULTIMATE CONTROL CENTER ───────────────────────────────────────────
# Unified Entry Point for Building, Deploying, and Managing Resumes
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")"

# Setup Virtual Environment
if [ ! -d "venv" ]; then
    echo -e "\033[1;33m📦 Creating virtual environment...\033[0m"
    python3 -m venv venv
fi
source venv/bin/activate
# Quietly ensure dependencies are up-to-date
pip install -q -r requirements.txt

# Run Manager
python3 src/manager.py
