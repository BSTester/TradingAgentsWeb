#!/usr/bin/env python3
"""
Migration: Add user LLM provider metadata settings table.
No user API key material is stored in this table.
"""

import sys
from pathlib import Path

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, MetaData, String, Table, UniqueConstraint
from sqlalchemy.sql import func


project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import sync_engine


def upgrade():
    metadata = MetaData()

    user_llm_provider_settings = Table(
        "user_llm_provider_settings",
        metadata,
        Column("id", Integer, primary_key=True, index=True),
        Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        Column("provider_name", String(100), nullable=False),
        Column("provider_type", String(20), nullable=False, default="custom"),
        Column("catalog_provider_id", Integer, ForeignKey("llm_providers.id", ondelete="SET NULL"), nullable=True, index=True),
        Column("display_name", String(200), nullable=False),
        Column("base_url", String(500), nullable=False),
        Column("shallow_model", String(200), nullable=False),
        Column("deep_model", String(200), nullable=False),
        Column("is_enabled", Boolean, nullable=False, default=True, index=True),
        Column("is_default", Boolean, nullable=False, default=False, index=True),
        Column("last_validated_at", DateTime(timezone=True), nullable=True),
        Column("last_validation_status", String(20), nullable=False, default="untested"),
        Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
        Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        UniqueConstraint("user_id", "provider_name", name="uq_user_llm_provider_settings_user_provider"),
        Index("ix_user_llm_provider_settings_user_enabled", "user_id", "is_enabled"),
        Index("ix_user_llm_provider_settings_user_default", "user_id", "is_default"),
    )

    user_llm_provider_settings.create(sync_engine, checkfirst=True)
    print("✅ user_llm_provider_settings table is ready")


def downgrade():
    with sync_engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE IF EXISTS user_llm_provider_settings")
    print("✅ user_llm_provider_settings table dropped")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
