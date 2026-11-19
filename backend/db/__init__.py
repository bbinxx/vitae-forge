from backend.db.postgres_repo import PostgresRepository
from backend.db.repository import AbstractRepository

db: AbstractRepository = PostgresRepository()
