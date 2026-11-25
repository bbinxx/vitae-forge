import unittest
from unittest.mock import MagicMock, patch

from backend.services.resume_service import get_full_config


class ResumeConfigReadTests(unittest.TestCase):
    def test_config_reads_all_three_documents_in_one_query(self):
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = [
            ("personal", {"name": "Synthetic"}),
            ("recipes", {"role": {"title": "Example"}}),
        ]

        with patch("backend.db.postgres_repo.repository_connection") as connect:
            connect.return_value.__enter__.return_value = connection
            config = get_full_config("synthetic-user")

        self.assertEqual(config, {
            "personal": {"name": "Synthetic"},
            "library": {},
            "recipes": {"role": {"title": "Example"}},
        })
        connect.assert_called_once_with()
        connection.execute.assert_called_once()
        _, paths = connection.execute.call_args.args
        self.assertEqual(paths, [
            ["users", "synthetic-user", "resume_data", name]
            for name in ("personal", "library", "recipes")
        ])

    def test_repository_borrows_a_connection_from_the_runtime_pool(self):
        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = []
        with patch("backend.db.postgres_repo._pool") as pool:
            pool.connection.return_value.__enter__.return_value = connection
            self.assertEqual(get_full_config("synthetic-user"), {
                "personal": {}, "library": {}, "recipes": {},
            })
        pool.connection.assert_called_once_with()
