#!/usr/bin/env python3
"""
Migration: Add can_access_intraday_trading field to users table
Adds a boolean field to control user access to intraday trading features
"""

import sys
from pathlib import Path
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import DATABASE_URL

# Convert async database URL to sync for migrations
SYNC_DATABASE_URL = DATABASE_URL.replace('+aiosqlite', '').replace('+aiomysql', '+pymysql')


def run_migration():
    """Add can_access_intraday_trading field to users table"""
    print("🔄 Running migration: add_can_access_intraday_trading")
    
    # Create engine
    engine = create_engine(SYNC_DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Check if column already exists
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'can_access_intraday_trading' in columns:
            print("✅ Column 'can_access_intraday_trading' already exists, skipping migration")
            return
        
        # Determine database type
        dialect_name = engine.dialect.name
        
        if dialect_name == 'sqlite':
            # SQLite: Add column with default value
            session.execute(text("""
                ALTER TABLE users 
                ADD COLUMN can_access_intraday_trading BOOLEAN NOT NULL DEFAULT 0
            """))
            print("✅ Added column 'can_access_intraday_trading' to users table (SQLite)")
            
        elif dialect_name == 'mysql':
            # MySQL: Add column with default value and index
            session.execute(text("""
                ALTER TABLE users 
                ADD COLUMN can_access_intraday_trading TINYINT(1) NOT NULL DEFAULT 0
            """))
            session.execute(text("""
                CREATE INDEX ix_users_can_access_intraday_trading 
                ON users (can_access_intraday_trading)
            """))
            print("✅ Added column 'can_access_intraday_trading' to users table (MySQL)")
            
        elif dialect_name == 'postgresql':
            # PostgreSQL: Add column with default value and index
            session.execute(text("""
                ALTER TABLE users 
                ADD COLUMN can_access_intraday_trading BOOLEAN NOT NULL DEFAULT FALSE
            """))
            session.execute(text("""
                CREATE INDEX ix_users_can_access_intraday_trading 
                ON users (can_access_intraday_trading)
            """))
            print("✅ Added column 'can_access_intraday_trading' to users table (PostgreSQL)")
            
        else:
            raise Exception(f"Unsupported database type: {dialect_name}")
        
        session.commit()
        print("✅ Migration completed successfully")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    run_migration()
