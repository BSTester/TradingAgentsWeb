#!/usr/bin/env python3
"""
Fix scheduled_tasks table - add missing columns
Supports both SQLite (development) and MySQL (production)
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables from .env file
env_path = project_root / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"[INFO] Loaded environment variables from {env_path}")
else:
    print(f"[WARNING] .env file not found at {env_path}")

# Get DATABASE_URL from environment or use default SQLite path
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # 默认使用项目根目录下的 db/tradingagents.db
    db_path = project_root / 'db' / 'tradingagents.db'
    DATABASE_URL = f"sqlite:///{db_path}"
    print(f"[INFO] Using default SQLite database: {DATABASE_URL}")

from sqlalchemy import create_engine, text, inspect

def fix_table():
    """Add missing columns to scheduled_tasks table"""
    # Detect database type
    is_mysql = DATABASE_URL.startswith("mysql")
    is_sqlite = DATABASE_URL.startswith("sqlite")
    
    # Convert async URL to sync URL
    if is_mysql:
        sync_url = DATABASE_URL.replace("+aiomysql", "+pymysql")
        engine = create_engine(sync_url, pool_pre_ping=True)
        db_type = "MySQL"
    elif is_sqlite:
        sync_url = DATABASE_URL.replace("+aiosqlite", "")
        engine = create_engine(sync_url, connect_args={"check_same_thread": False})
        db_type = "SQLite"
    else:
        sync_url = DATABASE_URL
        engine = create_engine(sync_url)
        db_type = "Unknown"
    
    print(f"[INFO] Detected database type: {db_type}")
    print(f"[INFO] Database URL: {sync_url.split('@')[-1] if '@' in sync_url else sync_url.split(':///')[-1]}")
    
    with engine.connect() as conn:
        # Check if table exists
        inspector = inspect(engine)
        if 'scheduled_tasks' not in inspector.get_table_names():
            print("[OK] scheduled_tasks table does not exist yet (will be created when first task is added)")
            return
        
        # Get existing columns
        columns = [col['name'] for col in inspector.get_columns('scheduled_tasks')]
        print(f"[INFO] Existing columns: {len(columns)} columns found")
        
        # Define fields to add with database-specific types
        if is_mysql:
            fields_to_add = [
                ('enable_trading_executor', 'BOOLEAN NOT NULL DEFAULT FALSE'),
                ('futu_api_base_url', 'VARCHAR(255) DEFAULT NULL'),
                ('futu_api_key', 'VARCHAR(255) DEFAULT NULL')
            ]
        else:  # SQLite
            fields_to_add = [
                ('enable_trading_executor', 'BOOLEAN NOT NULL DEFAULT 0'),
                ('futu_api_base_url', 'VARCHAR(255)'),
                ('futu_api_key', 'VARCHAR(255)')
            ]
        
        # Add missing columns
        for field_name, field_type in fields_to_add:
            if field_name in columns:
                print(f"[OK] {field_name} already exists")
            else:
                try:
                    sql = f"ALTER TABLE scheduled_tasks ADD COLUMN {field_name} {field_type}"
                    conn.execute(text(sql))
                    conn.commit()
                    print(f"[OK] Added {field_name} column ({field_type})")
                except Exception as e:
                    print(f"[ERROR] Failed to add {field_name}: {e}")
                    conn.rollback()

if __name__ == "__main__":
    try:
        fix_table()
        print("[OK] Migration completed successfully")
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
