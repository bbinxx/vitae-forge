import os
from src.db.repository import AbstractRepository
from src.db.firestore_repo import FirestoreRepository
from src.db.json_repo import JSONRepository

# Dependency Injection for DB Layer
if os.environ.get("FIREBASE_CREDENTIALS_PATH") or os.environ.get("FIREBASE_SERVICE_ACCOUNT"):
    db: AbstractRepository = FirestoreRepository()
else:
    db: AbstractRepository = JSONRepository()
