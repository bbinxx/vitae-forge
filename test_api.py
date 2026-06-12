from src.db import db
from src.services.resume_service import get_full_config

users = db.list_users()
for u in users:
    uid = u['id']
    config = get_full_config(uid)
    print(f"--- User: {u['username']} ---")
    print("Recipes:", list(config.get("recipes", {}).keys()))
    lib = config.get("library", {})
    if lib:
        # Just print the keys and the summary text
        print("Library summary:", lib.get("professional_summary", {}))
