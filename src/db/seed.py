import json
from pathlib import Path
from src.core.config import RESUME_CONFIG
from src.db import db

def seed_user_data(user_id: str):
    """Seed the database for a new user using resume_config.json if not exists."""
    existing_personal = db.get_personal(user_id)
    if existing_personal:
        print(f"User {user_id} already has data, skipping seed.")
        return

    print(f"Seeding database for user {user_id}...")
    
    if not RESUME_CONFIG.exists():
        print(f"Seed file {RESUME_CONFIG} not found.")
        return

    try:
        with open(RESUME_CONFIG, 'r') as f:
            data = json.load(f)
            
        personal = data.get("personal", {})
        library = data.get("library", {})
        recipes = data.get("recipes", {})
        
        db.save_personal(user_id, personal)
        db.save_library(user_id, library)
        db.save_recipes(user_id, recipes)
        
        print("Seed completed successfully.")
    except Exception as e:
        print(f"Failed to seed data: {e}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        seed_user_data(sys.argv[1])
    else:
        print("Usage: python -m src.db.seed <user_id>")
