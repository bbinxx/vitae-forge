import os
from contextlib import contextmanager
import unittest
from unittest.mock import patch
from uuid import uuid4

from backend.db.postgres_repo import PostgresRepository, connect, initialize


@unittest.skipUnless(os.getenv("DATABASE_URL"), "DATABASE_URL is required")
class PostgresRepositoryTests(unittest.TestCase):
    def test_user_documents_round_trip_without_leaving_test_records(self):
        connection = connect()
        self.addCleanup(connection.close)
        self.addCleanup(connection.rollback)
        initialize(connection)

        @contextmanager
        def test_connection():
            yield connection

        store = PostgresRepository()
        user_id, other_id = (f"test-{uuid4()}" for _ in range(2))
        application = {"id": "job", "resume_template": {"summary": "Synthetic"}}
        version = {"id": "v1", "data": {"sections": ["skills"]}}
        with patch("backend.db.postgres_repo.connect", test_connection):
            store.save_user(user_id, {"id": user_id, "username": user_id})
            store.save_user(user_id, {"password_hash": "synthetic hash"})
            self.assertEqual(store.get_user(user_id)["id"], user_id)
            self.assertEqual(store.get_user_by_id(user_id)["password_hash"], "synthetic hash")
            store.save_personal(user_id, {"name": "Synthetic"})
            store.save_library(user_id, {"skills": {"item": {"value": "SQL"}}})
            store.save_recipes(user_id, {"role": {"skills": ["item"]}})
            store.save_settings(user_id, {"bookmarks": [{"id": "bookmark"}]})
            store.save_application(user_id, application)
            store.save_app_version(user_id, "job", version)
            store.save_checkpoint(user_id, "snapshot", {"recipes": store.get_recipes(user_id)})
            self.assertEqual(store.get_personal(user_id), {"name": "Synthetic"})
            self.assertIn("item", store.get_library(user_id)["skills"])
            self.assertEqual(store.get_recipe(user_id, "role"), {"skills": ["item"]})
            self.assertEqual(store.get_settings(user_id)["bookmarks"][0]["id"], "bookmark")
            self.assertEqual(store.get_all_applications(user_id), [application])
            self.assertEqual(store.get_app_versions(user_id, "job"), [version])
            self.assertEqual(store.get_app_version(user_id, "job", "v1"), version)
            self.assertEqual(store.get_all_applications(other_id), [])
            self.assertIsNone(store.get_app_version(other_id, "job", "v1"))
            self.assertEqual(store.list_checkpoints(user_id), ["snapshot"])
            self.assertIn("role", store.get_checkpoint(user_id, "snapshot")["recipes"])
            store.delete_checkpoint(user_id, "snapshot")
            self.assertTrue(store.delete_app_version(user_id, "job", "v1"))
            store.delete_application(user_id, "job")
            self.assertEqual(store.list_checkpoints(user_id), [])
            self.assertEqual(store.get_app_versions(user_id, "job"), [])
            self.assertIsNone(store.get_application(user_id, "job"))
