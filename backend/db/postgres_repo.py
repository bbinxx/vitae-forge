"""PostgreSQL storage for Vitae Forge's per-user JSON documents."""

import os
from contextlib import contextmanager

import psycopg
from psycopg.types.json import Jsonb

from backend.db.repository import AbstractRepository


SCHEMA = """
CREATE TABLE IF NOT EXISTS vitae_documents (
    path text[] PRIMARY KEY,
    data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS vitae_usernames ON vitae_documents ((data ->> 'username'))
WHERE cardinality(path) = 2 AND path[1] = 'users';
"""


def connect():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is required")
    return psycopg.connect(url, connect_timeout=10, prepare_threshold=None)


def initialize(connection):
    connection.execute("SELECT pg_advisory_xact_lock(hashtext('vitae_documents_schema'))")
    connection.execute(SCHEMA)


@contextmanager
def repository_connection():
    try:
        with connect() as connection:
            yield connection
    except psycopg.Error:
        raise psycopg.Error("Database operation failed.") from None


class PostgresRepository(AbstractRepository):
    def _get(self, *path):
        with repository_connection() as connection:
            row = connection.execute(
                "SELECT data FROM vitae_documents WHERE path = %s", (list(path),)
            ).fetchone()
        return row[0] if row else None

    def _list(self, *prefix):
        with repository_connection() as connection:
            return connection.execute(
                """SELECT path[cardinality(path)], data FROM vitae_documents
                WHERE cardinality(path) = %s AND path[1:%s] = %s
                ORDER BY path""",
                (len(prefix) + 1, len(prefix), list(prefix)),
            ).fetchall()

    def _save(self, path, data, *, merge=False):
        update = "vitae_documents.data || EXCLUDED.data" if merge else "EXCLUDED.data"
        with repository_connection() as connection:
            connection.execute(
                f"""INSERT INTO vitae_documents (path, data) VALUES (%s, %s)
                ON CONFLICT (path) DO UPDATE SET data = {update}""",
                (list(path), Jsonb(data)),
            )

    def _delete(self, *path):
        with repository_connection() as connection:
            connection.execute("DELETE FROM vitae_documents WHERE path = %s", (list(path),))

    def get_user(self, username):
        with repository_connection() as connection:
            row = connection.execute(
                """SELECT data FROM vitae_documents
                WHERE cardinality(path) = 2 AND path[1] = 'users'
                    AND data ->> 'username' = %s ORDER BY path LIMIT 1""",
                (username,),
            ).fetchone()
        return row[0] if row else None

    def get_user_by_id(self, user_id):
        return self._get("users", user_id)

    def save_user(self, user_id, user):
        self._save(("users", user_id), user, merge=True)

    def list_users(self):
        return [data for _, data in self._list("users")]

    def get_personal(self, user_id):
        return self._get("users", user_id, "resume_data", "personal") or {}

    def save_personal(self, user_id, data):
        self._save(("users", user_id, "resume_data", "personal"), data)

    def get_library(self, user_id):
        return self._get("users", user_id, "resume_data", "library") or {}

    def save_library(self, user_id, data):
        self._save(("users", user_id, "resume_data", "library"), data)

    def get_recipes(self, user_id):
        return self._get("users", user_id, "resume_data", "recipes") or {}

    def save_recipes(self, user_id, data):
        self._save(("users", user_id, "resume_data", "recipes"), data)

    def get_recipe(self, user_id, recipe_id):
        return self.get_recipes(user_id).get(recipe_id)

    def get_all_applications(self, user_id):
        return [data for _, data in self._list("users", user_id, "applications")]

    def get_application(self, user_id, app_id):
        return self._get("users", user_id, "applications", app_id)

    def save_application(self, user_id, app):
        if app.get("id"):
            self._save(("users", user_id, "applications", app["id"]), app)

    def delete_application(self, user_id, app_id):
        self._delete("users", user_id, "applications", app_id)

    def get_app_versions(self, user_id, app_id):
        return [data for _, data in self._list("users", user_id, "applications", app_id, "versions")]

    def save_app_version(self, user_id, app_id, version_data):
        if version_data.get("id"):
            self._save(("users", user_id, "applications", app_id, "versions", version_data["id"]), version_data)

    def get_app_version(self, user_id, app_id, v_id):
        return self._get("users", user_id, "applications", app_id, "versions", v_id)

    def delete_app_version(self, user_id, app_id, v_id):
        try:
            self._delete("users", user_id, "applications", app_id, "versions", v_id)
        except psycopg.Error:
            return False
        return True

    def list_checkpoints(self, user_id):
        return [name for name, _ in self._list("users", user_id, "checkpoints")]

    def save_checkpoint(self, user_id, name, data):
        self._save(("users", user_id, "checkpoints", name), data)

    def get_checkpoint(self, user_id, name):
        return self._get("users", user_id, "checkpoints", name)

    def delete_checkpoint(self, user_id, name):
        self._delete("users", user_id, "checkpoints", name)

    def get_settings(self, user_id):
        return self._get("users", user_id, "resume_data", "settings") or {}

    def save_settings(self, user_id, data):
        self._save(("users", user_id, "resume_data", "settings"), data)
