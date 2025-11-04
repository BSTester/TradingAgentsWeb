#!/usr/bin/env python3
"""
Database migration: Add UserConfig table for storing user-specific settings
Supports both SQLite (development) and MySQL (production)
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from web.backend.database import DATABASE_URL

def migrate():
    """Add UserConfig table"""
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
        # Check if table already exists (database-agnostic)
        if is_mysql:
            result = conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'user_configs'"
            ))
            table_exists = result.scalar() > 0
        else:  # SQLite
            result = conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='user_configs'"
            ))
            table_exists = result.fetchone() is not None
        
        if table_exists:
            print("[OK] user_configs table already exists")
            return
        
        # Create user_configs table with database-specific syntax
        if is_mysql:
            conn.execute(text("""
                CREATE TABLE user_configs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL UNIQUE,
                    last_analysts JSON,
                    last_research_depth INT,
                    last_llm_provider VARCHAR(50),
                    last_shallow_thinker VARCHAR(100),
                    last_deep_thinker VARCHAR(100),
                    last_backend_url VARCHAR(255),
                    enable_trading_executor BOOLEAN NOT NULL DEFAULT FALSE,
                    futu_api_base_url VARCHAR(255),
                    futu_api_key VARCHAR(255),
                    last_openai_api_key VARCHAR(255),
                    last_anthropic_api_key VARCHAR(255),
                    last_google_api_key VARCHAR(255),
                    last_openrouter_api_key VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """))
        else:  # SQLite
            conn.execute(text("""
                CREATE TABLE user_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL UNIQUE,
                    last_analysts TEXT,
                    last_research_depth INTEGER,
                    last_llm_provider VARCHAR(50),
                    last_shallow_thinker VARCHAR(100),
                    last_deep_thinker VARCHAR(100),
                    last_backend_url VARCHAR(255),
                    enable_trading_executor BOOLEAN NOT NULL DEFAULT 0,
                    futu_api_base_url VARCHAR(255),
                    futu_api_key VARCHAR(255),
                    last_openai_api_key VARCHAR(255),
                    last_anthropic_api_key VARCHAR(255),
                    last_google_api_key VARCHAR(255),
                    last_openrouter_api_key VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """))
        
        conn.commit()
        print(f"[OK] Created user_configs table ({db_type})")

if __name__ == "__main__":
    migrate()
    print("[OK] Migration completed")
