#!/usr/bin/env python3
"""
Database migration: Add trading executor fields to ScheduledTask table
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from web.backend.database import DATABASE_URL

def migrate():
    """Add trading executor fields to scheduled_tasks table"""
    # Convert async URL to sync URL for migration
    sync_url = DATABASE_URL.replace("+aiosqlite", "")
    engine = create_engine(sync_url, connect_args={"check_same_thread": False})
    
    with engine.connect() as conn:
        # Check if table exists
        result = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_tasks'"
        ))
        if not result.fetchone():
            print("❌ scheduled_tasks table does not exist.")
            return
        
        # Check if columns already exist
        result = conn.execute(text("PRAGMA table_info(scheduled_tasks)"))
        columns = [row[1] for row in result.fetchall()]
        
        fields_to_add = [
            ('enable_trading_executor', 'BOOLEAN NOT NULL DEFAULT 0'),
            ('futu_api_base_url', 'VARCHAR(255)'),
            ('futu_api_key', 'VARCHAR(255)')
        ]
        
        for field_name, field_type in fields_to_add:
            if field_name in columns:
                print(f"✅ {field_name} already exists")
            else:
                conn.execute(text(f"ALTER TABLE scheduled_tasks ADD COLUMN {field_name} {field_type}"))
                print(f"✅ Added {field_name} column")
        
        conn.commit()

if __name__ == "__main__":
    migrate()
    print("✅ Migration completed")
