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
            store.save_checkpoint(user_id, "bm_synthetic", {"bookmark": {"id": "synthetic"}})
            store.save_template_override(user_id, "template.tex", "% Synthetic")
            self.assertEqual(store.list_bookmarks(user_id), [{"id": "synthetic"}])
            self.assertEqual(store.list_bookmarks(other_id), [])
            self.assertEqual(store.get_template_override(user_id, "template.tex"), "% Synthetic")
            self.assertIsNone(store.get_template_override(other_id, "template.tex"))
            store.delete_checkpoint(user_id, "bm_synthetic")
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

    def test_registration_and_sign_in_use_database_unique_username(self):
        from fastapi.testclient import TestClient
        from backend.app import app

        connection = connect()
        self.addCleanup(connection.close)
        self.addCleanup(connection.rollback)
        initialize(connection)

        @contextmanager
        def test_connection():
            yield connection

        username = f"candidate-{uuid4()}"
        credentials = {"username": username, "password": "synthetic-password"}
        client = TestClient(app)
        self.addCleanup(client.close)
        with patch("backend.db.postgres_repo.connect", test_connection):
            registered = client.post("/api/auth/register", json=credentials)
            self.assertEqual(registered.status_code, 200)
            user = registered.json()["user"]
            stored = PostgresRepository().get_user(username)
            self.assertEqual(stored["id"], user["id"])
            self.assertNotEqual(stored["password_hash"], credentials["password"])
            duplicate = client.post("/api/auth/register", json=credentials)
            self.assertEqual(duplicate.status_code, 400)
            self.assertFalse(PostgresRepository().create_user("another-id", {"username": username}))
            self.assertEqual(client.get("/api/auth/me").json()["id"], user["id"])
            self.assertEqual(client.post("/api/auth/logout").status_code, 200)
            self.assertEqual(client.post("/api/auth/login", json=credentials).json()["user"], user)
