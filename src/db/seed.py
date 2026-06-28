import json
from pathlib import Path
from src.core.config import RESUME_CONFIG
from src.db import db

def seed_new_user(user_id: str, db_repo=None):
    """
    Seeds a new user with the generic template configuration.
    """
    target_db = db_repo or db
    template_path = Path(__file__).parent.parent.parent / "configs" / "resume_config.template.json"
    
    existing_personal = target_db.get_personal(user_id)
    if existing_personal:
        print(f"User {user_id} already has data, skipping seed.")
        return

    print(f"Seeding database for user {user_id}...")
    
    if not template_path.exists():
        print(f"Seed file {template_path} not found.")
        return

    try:
        with open(template_path, 'r') as f:
            data = json.load(f)
            
        personal = data.get("personal", {})
        library = data.get("library", {})
        recipes = data.get("recipes", {})
        
        target_db.save_personal(user_id, personal)
        target_db.save_library(user_id, library)
        target_db.save_recipes(user_id, recipes)
        
        print("Seed completed successfully.")
    except Exception as e:
        print(f"Failed to seed data: {e}")

seed_user_data = seed_new_user

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        seed_new_user(sys.argv[1], db)
    else:
        print("Usage: python -m src.db.seed <user_id>")
