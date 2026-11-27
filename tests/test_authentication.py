import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from jose import jwt

from backend.api.auth import ALGORITHM, SECRET_KEY, create_access_token
from backend.app import app
from backend.services.user_service import authenticate_user


class AuthenticationTests(unittest.TestCase):
    def test_workspace_routes_redirect_to_login_with_return_path(self):
        client = TestClient(app)
        for page in ("applications", "saved-resumes", "templates", "settings"):
            with self.subTest(page=page):
                response = client.get(f"/workspace/{page}", follow_redirects=False)
                self.assertEqual(response.status_code, 307)
                self.assertEqual(response.headers["location"], f"/login?next=%2Fworkspace%2F{page}")
        response = client.get("/", follow_redirects=False)
        self.assertEqual(response.status_code, 307)
        self.assertEqual(response.headers["location"], "/login?next=%2Fworkspace%2Fapplications")
        for path in ("/pdf/synthetic.pdf", "/user-assets/synthetic.jpg"):
            self.assertEqual(client.get(path, follow_redirects=False).status_code, 307)

    def test_workspace_redirects_with_invalid_cookie_but_allows_valid_session(self):
        client = TestClient(app)
        client.cookies.set("auth_token", "invalid")
        self.assertEqual(client.get("/workspace/settings", follow_redirects=False).status_code, 307)
        client.cookies.set("auth_token", create_access_token({"sub": "synthetic-user"}))
        response = client.get("/workspace/settings", follow_redirects=False)
        self.assertIn(response.status_code, (200, 503))  # HTML can be unbuilt in source-only CI.

    def test_registration_trims_username_and_sets_http_only_cookie(self):
        user = {"id": "synthetic-user", "username": "candidate"}
        with patch("backend.api.auth.create_user", return_value=user) as create_user:
            with TestClient(app, base_url="https://testserver") as client:
                response = client.post("/api/auth/register", json={
                    "username": " candidate ", "password": "synthetic-password",
                })
        self.assertEqual(response.status_code, 200)
        create_user.assert_called_once_with("candidate", "synthetic-password")
        self.assertIn("HttpOnly", response.headers["set-cookie"])
        self.assertIn("Secure", response.headers["set-cookie"])

    def test_registration_rejects_password_over_bcrypt_byte_limit(self):
        with patch("backend.api.auth.create_user") as create_user:
            response = TestClient(app).post("/api/auth/register", json={
                "username": "candidate", "password": "é" * 37,
            })
        self.assertEqual(response.status_code, 400)
        create_user.assert_not_called()

    def test_current_session_requires_an_existing_account(self):
        token = create_access_token({"sub": "missing-user"})
        with patch("backend.api.auth.get_user_by_id", return_value=None):
            response = TestClient(app).get(
                "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
            )
        self.assertEqual(response.status_code, 401)

    def test_invalid_stored_password_hash_fails_login_cleanly(self):
        with patch("backend.services.user_service.db.get_user", return_value={"password_hash": "invalid"}):
            self.assertIsNone(authenticate_user("candidate", "synthetic-password"))

    def test_preview_rejects_bearer_tokens_without_expiration(self):
        token = jwt.encode({"sub": "synthetic-user"}, SECRET_KEY, algorithm=ALGORITHM)
        response = TestClient(app).post(
            "/api/preview-pdf",
            headers={"Authorization": f"Bearer {token}"},
            json={"config": {"personal": {"name": "Synthetic"}}},
        )
        self.assertEqual(response.status_code, 401)
