"""Import a Firestore snapshot from stdin and verify the rows before commit."""

from collections import Counter
import json
import sys

from psycopg.types.json import Jsonb

from backend.db.postgres_repo import connect, initialize


def main():
    records = json.load(sys.stdin)
    if not records:
        raise ValueError("Source snapshot is empty")
    source = {}
    for path, data in records:
        key = tuple(path)
        if (not key or len(key) % 2 or not all(isinstance(part, str) and part for part in key)
                or not isinstance(data, dict) or key in source):
            raise ValueError("Invalid document path or payload")
        source[key] = data

    with connect() as connection:
        initialize(connection)
        connection.execute("LOCK TABLE vitae_documents IN SHARE ROW EXCLUSIVE MODE")
        existing = {tuple(path): data for path, data in connection.execute(
            "SELECT path, data FROM vitae_documents"
        )}
        if any(key not in source or source[key] != data for key, data in existing.items()):
            raise ValueError("Destination contains records that differ from the source snapshot")
        with connection.cursor() as cursor:
            cursor.executemany(
                "INSERT INTO vitae_documents (path, data) VALUES (%s, %s) ON CONFLICT (path) DO NOTHING",
                [(list(key), Jsonb(data)) for key, data in source.items() if key not in existing],
            )
        imported = {tuple(path): data for path, data in connection.execute(
            "SELECT path, data FROM vitae_documents"
        )}
        if imported != source:
            raise ValueError("PostgreSQL readback did not match the source snapshot")
    counts = Counter(key[-2] for key in imported)
    print(f"Verified {len(imported)} documents across {len(counts)} collection types")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"PostgreSQL import failed ({type(error).__name__})", file=sys.stderr)
        sys.exit(1)
