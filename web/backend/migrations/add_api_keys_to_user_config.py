#!/usr/bin/env python3
"""
Database migration: Add API key fields to UserConfig table
Supports both SQLite (development) and MySQL (production)
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text, inspect
from web.backend.database import DATABASE_URL

def migrate():
    """Add API key fields to user_configs table"""
    # Detect database type and convert async URL to sync URL
    is_mysql = DATABASE_URL.startswith("mysql")
    
    if is_mysql:
        sync_url = DATABASE_URL.replace("+aiomysql", "+pymysql")
        engine = create_engine(sync_url, pool_pre_ping=True)
        db_type = "MySQL"
    else:  # SQLite
        sync_url = DATABASE_URL.replace("+aiosqlite", "")
        engine = create_engine(sync_url, connect_args={"check_same_thread": False})
        db_type = "SQLite"
    
    print(f"[INFO] Database type: {db_type}")
    
    with engine.connect() as conn:
        # Check if table exists (database-agnostic)
        inspector = inspect(engine)
        if 'user_configs' not in inspector.get_table_names():
            print("[ERROR] user_configs table does not exist. Run add_user_config.py first.")
            return
        
        # Get existing columns (database-agnostic)
        columns = [col['name'] for col in inspector.get_columns('user_configs')]
        
        # Define fields with database-specific syntax
        if is_mysql:
            fields_to_add = [
                ('last_openai_api_key', 'VARCHAR(255) DEFAULT NULL'),
                ('last_anthropic_api_key', 'VARCHAR(255) DEFAULT NULL'),
                ('last_google_api_key', 'VARCHAR(255) DEFAULT NULL'),
                ('last_openrouter_api_key', 'VARCHAR(255) DEFAULT NULL')
            ]
        else:  # SQLite
            fields_to_add = [
                ('last_openai_api_key', 'VARCHAR(255)'),
                ('last_anthropic_api_key', 'VARCHAR(255)'),
                ('last_google_api_key', 'VARCHAR(255)'),
                ('last_openrouter_api_key', 'VARCHAR(255)')
            ]
        
        for field_name, field_type in fields_to_add:
            if field_name in columns:
                print(f"[OK] {field_name} already exists")
            else:
                try:
                    conn.execute(text(f"ALTER TABLE user_configs ADD COLUMN {field_name} {field_type}"))
                    conn.commit()
                    print(f"[OK] Added {field_name} column")
                except Exception as e:
                    print(f"[ERROR] Failed to add {field_name}: {e}")
                    conn.rollback()

if __name__ == "__main__":
    migrate()
    print("[OK] Migration completed")
