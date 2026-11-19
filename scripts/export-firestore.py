"""One-time export. Run with the legacy Firebase runtime and pipe to import-postgres.py."""

from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import json
import os
import sys

import firebase_admin
from firebase_admin import credentials, firestore


def json_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError("Firestore document contains a value outside the application JSON format")


def read_document(ref, read_time):
    snapshot = ref.get(read_time=read_time, timeout=30)
    record = (ref.path.split("/"), snapshot.to_dict()) if snapshot.exists else None
    return record, list(ref.collections(read_time=read_time, timeout=30))


def main():
    path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if path and os.path.isfile(path):
        credential = credentials.Certificate(path)
    elif service_account:
        credential = credentials.Certificate(json.loads(service_account))
    else:
        raise RuntimeError("Legacy Firestore credentials are missing")

    firebase_admin.initialize_app(credential)
    client = firestore.client()
    read_time = datetime.now(timezone.utc)
    records = []
    collections = list(client.collections(read_time=read_time, timeout=30))
    with ThreadPoolExecutor(max_workers=8) as executor:
        while collections:
            references = [
                ref
                for group in executor.map(
                    lambda collection: list(collection.list_documents(read_time=read_time, timeout=30)),
                    collections,
                )
                for ref in group
            ]
            next_collections = []
            for record, children in executor.map(
                lambda ref: read_document(ref, read_time), references
            ):
                if record is not None:
                    records.append(record)
                next_collections.extend(children)
            collections = next_collections
    if not records:
        raise RuntimeError("Refusing to import an empty source snapshot")
    json.dump(records, sys.stdout, default=json_value, allow_nan=False)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Firestore export failed ({type(error).__name__})", file=sys.stderr)
        sys.exit(1)
