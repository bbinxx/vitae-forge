import sys
from pathlib import Path
import os
import json

# Add project root to sys.path
_project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_project_root))

from src.core.config import ENV_FILE, load_applications

try:
    from dotenv import load_dotenv
    if ENV_FILE.exists():
        load_dotenv(ENV_FILE)
except ImportError:
    pass

from src.core.firebase import save_application

def run_migration():
    data = load_applications()
    apps = data.get("applications", [])
    if not apps:
        print("No applications found in local JSON.")
        return
        
    print(f"Found {len(apps)} applications to migrate to Firebase...")
    success = 0
    for app in apps:
        app_id = app.get("id")
        # Ensure we don't accidentally push empty IDs
        if not app_id:
            continue
            
        print(f" Migrating {app_id} ({app.get('company', 'Unknown')})...")
        if save_application(app):
            success += 1
        else:
            print(f" Failed to save {app_id} to Firebase.")
            
    print(f"Migration complete: {success}/{len(apps)} successfully migrated.")

if __name__ == "__main__":
    run_migration()
