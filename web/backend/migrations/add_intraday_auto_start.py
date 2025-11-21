#!/usr/bin/env python3
"""
Migration: Add intraday_scheduler_auto_start field to user_configs table

This field tracks whether a scheduler should be automatically restarted
when the service restarts. It's set to True when user manually starts
the scheduler, and False when user manually stops it.

This allows the system to distinguish between:
- Service crash/restart (auto_start=True -> restore scheduler)
- Manual stop by user (auto_start=False -> don't restore)
"""

from sqlalchemy import Column, Boolean, text
from web.backend.database import sync_engine
import logging

logger = logging.getLogger(__name__)


def upgrade():
    """Add intraday_scheduler_auto_start column"""
    try:
        with sync_engine.connect() as conn:
            # Check if column already exists
            if sync_engine.dialect.name == 'sqlite':
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM pragma_table_info('user_configs') "
                    "WHERE name='intraday_scheduler_auto_start'"
                ))
                exists = result.scalar() > 0
            elif sync_engine.dialect.name == 'mysql':
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() "
                    "AND TABLE_NAME = 'user_configs' "
                    "AND COLUMN_NAME = 'intraday_scheduler_auto_start'"
                ))
                exists = result.scalar() > 0
            else:
                # PostgreSQL
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM information_schema.columns "
                    "WHERE table_name='user_configs' "
                    "AND column_name='intraday_scheduler_auto_start'"
                ))
                exists = result.scalar() > 0
            
            if exists:
                logger.info("Column intraday_scheduler_auto_start already exists, skipping")
                return False
            
            # Add column
            if sync_engine.dialect.name == 'sqlite':
                conn.execute(text(
                    "ALTER TABLE user_configs "
                    "ADD COLUMN intraday_scheduler_auto_start BOOLEAN DEFAULT 0 NOT NULL"
                ))
            elif sync_engine.dialect.name == 'mysql':
                conn.execute(text(
                    "ALTER TABLE user_configs "
                    "ADD COLUMN intraday_scheduler_auto_start TINYINT(1) DEFAULT 0 NOT NULL"
                ))
            else:
                # PostgreSQL
                conn.execute(text(
                    "ALTER TABLE user_configs "
                    "ADD COLUMN intraday_scheduler_auto_start BOOLEAN DEFAULT FALSE NOT NULL"
                ))
            
            conn.commit()
            logger.info("✅ Added intraday_scheduler_auto_start column to user_configs")
            return True
    
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        raise


def downgrade():
    """Remove intraday_scheduler_auto_start column"""
    try:
        with sync_engine.connect() as conn:
            # Check if column exists
            if sync_engine.dialect.name == 'sqlite':
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM pragma_table_info('user_configs') "
                    "WHERE name='intraday_scheduler_auto_start'"
                ))
                exists = result.scalar() > 0
            elif sync_engine.dialect.name == 'mysql':
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() "
                    "AND TABLE_NAME = 'user_configs' "
                    "AND COLUMN_NAME = 'intraday_scheduler_auto_start'"
                ))
                exists = result.scalar() > 0
            else:
                # PostgreSQL
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM information_schema.columns "
                    "WHERE table_name='user_configs' "
                    "AND column_name='intraday_scheduler_auto_start'"
                ))
                exists = result.scalar() > 0
            
            if not exists:
                logger.info("Column intraday_scheduler_auto_start doesn't exist, skipping")
                return False
            
            # Drop column
            conn.execute(text(
                "ALTER TABLE user_configs DROP COLUMN intraday_scheduler_auto_start"
            ))
            conn.commit()
            logger.info("✅ Removed intraday_scheduler_auto_start column from user_configs")
            return True
    
    except Exception as e:
        logger.error(f"❌ Downgrade failed: {e}")
        raise


if __name__ == "__main__":
    # Run migration
    upgrade()
