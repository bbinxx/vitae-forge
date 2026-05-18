#!/usr/bin/env python3
import os
import sys
import json
import time
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
CONFIG_FILE = ROOT_DIR / "configs/resume_config.json"

# ANSI Colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
BLUE = '\033[0;34m'
CYAN = '\033[0;36m'
YELLOW = '\033[1;33m'
BOLD = '\033[1m'
NC = '\033[0m'

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def show_header():
    clear_screen()
    print(f"{CYAN}{BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{NC}")
    print(f"{CYAN}{BOLD}             RESUME STUDIO ULTIMATE CONTROL CENTER             {NC}")
    print(f"{CYAN}{BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{NC}\n")

def show_menu():
    print(f"{BOLD}MAIN MENU{NC}")
    print("  [1] 🚀 Start Web Studio (FastAPI Dashboard)")
    print("  [2] 🏗️  Build All Resumes (Standard + Photo)")
    print("  [3] 🎯 Build Specific Role")
    print("  [4] 🧹 Clean Build Artifacts (dist/logs)")
    print("  [5] ☁️  Sync to Cloud (R2 Upload)")
    print("  [6] 🏷️  Tag Version & Git Push")
    print("  [0] 🚪 Exit\n")
    return input(f"{BOLD}Select an option: {NC}")

def run_studio():
    print(f"{GREEN}🚀 Starting Studio at http://127.0.0.1:5050...{NC}")
    try:
        subprocess.run([sys.executable, "-m", "uvicorn", "src.studio:app", "--host", "127.0.0.1", "--port", "5050", "--reload"], cwd=str(ROOT_DIR))
    except KeyboardInterrupt:
        pass

def run_build_all():
    print(f"{GREEN}🏗️  Building all variants...{NC}")
    subprocess.run([sys.executable, "src/build.py"], cwd=str(ROOT_DIR))
    input("\nPress Enter to continue...")

def run_build_role():
    try:
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
        roles = list(config.get("recipes", {}).keys())
    except Exception as e:
        print(f"{RED}Error reading config: {e}{NC}")
        roles = []
    
    print(f"{BLUE}Available roles:{NC} " + " ".join(roles))
    role_id = input(f"{BOLD}Enter Role ID: {NC}").strip()
    if role_id:
        subprocess.run([sys.executable, "src/build.py", role_id], cwd=str(ROOT_DIR))
    else:
        print(f"{RED}Invalid Role ID.{NC}")
    input("\nPress Enter to continue...")

def run_clean():
    print(f"{YELLOW}🧹 Cleaning...{NC}")
    subprocess.run([sys.executable, "src/build.py", "clean"], cwd=str(ROOT_DIR))
    input("\nPress Enter to continue...")

def run_sync():
    print(f"{BLUE}☁️  Syncing to R2...{NC}")
    subprocess.run([sys.executable, "src/upload_r2.py"], cwd=str(ROOT_DIR))
    print(f"{GREEN}✅ Sync complete.{NC}")
    input("\nPress Enter to continue...")

def run_tag():
    version = input(f"{BOLD}Enter Version (e.g., 1.0.0): {NC}").strip()
    if version:
        subprocess.run([sys.executable, "src/tag_version.py", version], cwd=str(ROOT_DIR))
    else:
        print(f"{RED}Version cannot be empty.{NC}")
    input("\nPress Enter to continue...")

def main():
    # Make sure we are in the root directory
    os.chdir(ROOT_DIR)
    
    while True:
        show_header()
        opt = show_menu().strip()
        
        if opt == '1': run_studio()
        elif opt == '2': run_build_all()
        elif opt == '3': run_build_role()
        elif opt == '4': run_clean()
        elif opt == '5': run_sync()
        elif opt == '6': run_tag()
        elif opt == '0': 
            print(f"{CYAN}Goodbye!{NC}")
            break
        else:
            print(f"{RED}Invalid option!{NC}")
            time.sleep(1)

if __name__ == "__main__":
    main()
