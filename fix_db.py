from src.db import db
from src.db.seed import seed_new_user
users = db.list_users()
print("Found users:", users)
for u in users:
    uid = u['id']
    print(f"Reseeding user {uid}")
    # We can delete personal, library, recipes to force reseed, or just call seed_new_user and overwrite.
    # Wait, seed_new_user skips if personal exists: "if existing_personal: skip".
    # We must wipe it first.
    db.save_personal(uid, {})
    db.save_library(uid, {})
    db.save_recipes(uid, {})
    # Now it's wiped.
    seed_new_user(uid, db)
print("Done!")
