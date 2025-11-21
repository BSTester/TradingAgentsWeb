#!/usr/bin/env python3
"""
Migration: Add intraday trading configuration fields to user_configs table
"""

from sqlalchemy import text
from web.backend.database import sync_engine


def upgrade():
    """Add intraday trading configuration fields"""
    with sync_engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("PRAGMA table_info(user_configs)"))
        columns = [row[1] for row in result.fetchall()]
        
        migrations = []
        
        if 'intraday_futu_api_url' not in columns:
            migrations.append(
                "ALTER TABLE user_configs ADD COLUMN intraday_futu_api_url VARCHAR(255)"
            )
        
        if 'intraday_futu_api_key' not in columns:
            migrations.append(
                "ALTER TABLE user_configs ADD COLUMN intraday_futu_api_key VARCHAR(255)"
            )
        
        if 'intraday_scheduler_enabled' not in columns:
            migrations.append(
                "ALTER TABLE user_configs ADD COLUMN intraday_scheduler_enabled BOOLEAN DEFAULT 0 NOT NULL"
            )
        
        if 'intraday_interval_minutes' not in columns:
            migrations.append(
                "ALTER TABLE user_configs ADD COLUMN intraday_interval_minutes INTEGER DEFAULT 5 NOT NULL"
            )
        
        if 'intraday_market_type' not in columns:
            migrations.append(
                "ALTER TABLE user_configs ADD COLUMN intraday_market_type VARCHAR(10) DEFAULT 'US' NOT NULL"
            )
        
        # Execute migrations
        for migration in migrations:
            print(f"Executing: {migration}")
            conn.execute(text(migration))
            conn.commit()
        
        if migrations:
            print(f"✅ Added {len(migrations)} intraday trading configuration fields")
        else:
            print("✅ All intraday trading configuration fields already exist")


def downgrade():
    """Remove intraday trading configuration fields"""
    # SQLite doesn't support DROP COLUMN easily, so we skip downgrade
    print("⚠️  Downgrade not supported for SQLite")


if __name__ == "__main__":
    print("Running migration: add_intraday_config_fields")
    upgrade()
    print("Migration complete!")
