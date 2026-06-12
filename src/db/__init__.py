import os
from src.db.repository import AbstractRepository
from src.db.firestore_repo import FirestoreRepository

# Force Firestore as the only repository
db: AbstractRepository = FirestoreRepository()
