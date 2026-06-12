from src.db import db
from src.db.seed import seed_new_user

# Get ALL personal documents from the resume_data subcollections
try:
    docs = db.db.collection_group("resume_data").stream()
    for doc in docs:
        print(f"Found document: {doc.reference.path}")
        user_id = doc.reference.path.split('/')[1]
        print(f"Resetting user: {user_id}")
        db.save_personal(user_id, {})
        db.save_library(user_id, {})
        db.save_recipes(user_id, {})
        seed_new_user(user_id, db)
except Exception as e:
    print(f"Error: {e}")
