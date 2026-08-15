from backend.db.repository import AbstractRepository
from backend.db.firestore_repo import FirestoreRepository

# Force Firestore as the only repository
db: AbstractRepository = FirestoreRepository()
