"""Regression coverage for fresh-database LLM provider bootstrapping."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class LLMProviderBootstrapTests(unittest.TestCase):
    def test_empty_sqlite_bootstrap_seeds_providers_with_is_default(self):
        """Startup migrations must seed a fresh ORM-created SQLite database."""
        with tempfile.TemporaryDirectory() as tmpdir:
            database_path = Path(tmpdir) / "bootstrap.db"
            environment = os.environ.copy()
            environment["DATABASE_URL"] = f"sqlite+aiosqlite:///{database_path}"
            script = """
from sqlalchemy import create_engine, text

from web.backend.database import init_db_sync
from web.backend.migrations.auto_migrate import auto_migrate

init_db_sync()
_, failed, _ = auto_migrate(verbose=False)
assert failed == 0, f\"fresh bootstrap migration failures: {{failed}}\"

engine = create_engine("sqlite:///{database_path}")
with engine.connect() as connection:
    providers = connection.execute(
        text("SELECT provider_name, is_active, is_default FROM llm_providers ORDER BY provider_name")
    ).mappings().all()
    openai_model_types = connection.execute(
        text(
            "SELECT model_type FROM llm_models "
            "JOIN llm_providers ON llm_providers.id = llm_models.provider_id "
            "WHERE llm_providers.provider_name = 'openai'"
        )
    ).scalars().all()

assert {{provider["provider_name"] for provider in providers}} == {{
    "anthropic", "custom", "deepseek", "openai"
}}
assert next(provider for provider in providers if provider["provider_name"] == "openai")["is_active"] in (1, True)
assert all(provider["is_default"] in (0, False) for provider in providers)
assert {{"shallow_thinker", "deep_thinker"}} <= set(openai_model_types)
""".format(database_path=database_path)

            result = subprocess.run(
                [sys.executable, "-c", script],
                cwd=PROJECT_ROOT,
                env=environment,
                text=True,
                capture_output=True,
                timeout=60,
            )

        self.assertEqual(
            result.returncode,
            0,
            msg=f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}",
        )


if __name__ == "__main__":
    unittest.main()
