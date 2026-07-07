#!/usr/bin/env python3
"""
Migration: Add system default marker to LLM providers.
"""

import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import DATABASE_URL


SYNC_DATABASE_URL = DATABASE_URL.replace("+aiosqlite", "").replace("+aiomysql", "+pymysql")


def upgrade():
    engine = create_engine(SYNC_DATABASE_URL)
    inspector = inspect(engine)

    if not inspector.has_table("llm_providers"):
        print("llm_providers table does not exist; schema sync will add is_default later")
        return

    columns = {column["name"] for column in inspector.get_columns("llm_providers")}
    if "is_default" in columns:
        print("llm_providers.is_default already exists")
        return

    if engine.dialect.name == "mysql":
        column_sql = "TINYINT(1) NOT NULL DEFAULT 0"
    else:
        column_sql = "BOOLEAN NOT NULL DEFAULT 0"

    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE llm_providers ADD COLUMN is_default {column_sql}"))

    print("Added llm_providers.is_default")


def downgrade():
    print("Downgrade is not supported for llm_providers.is_default")


if __name__ == "__main__":
    upgrade()
