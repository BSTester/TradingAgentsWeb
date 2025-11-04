#!/usr/bin/env python3
"""
Add last_ticker column to user_configs table
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect

# Load environment variables
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

def add_last_ticker_column():
    """Add last_ticker column to user_configs table"""
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
        if 'user_configs' not in inspector.get_table_names():
            print("[OK] user_configs table does not exist yet (will be created automatically)")
            return
        
        # Get existing columns
        columns = [col['name'] for col in inspector.get_columns('user_configs')]
        print(f"[INFO] Existing columns: {len(columns)} columns found")
        
        # Check if last_ticker column already exists
        if 'last_ticker' in columns:
            print("[OK] last_ticker column already exists")
            return
        
        # Add last_ticker column
        try:
            if is_mysql:
                sql = "ALTER TABLE user_configs ADD COLUMN last_ticker VARCHAR(20) DEFAULT NULL AFTER user_id"
            else:  # SQLite
                sql = "ALTER TABLE user_configs ADD COLUMN last_ticker VARCHAR(20)"
            
            conn.execute(text(sql))
            conn.commit()
            print(f"[OK] Added last_ticker column")
        except Exception as e:
            print(f"[ERROR] Failed to add last_ticker column: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    try:
        add_last_ticker_column()
        print("[OK] Migration completed successfully")
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
