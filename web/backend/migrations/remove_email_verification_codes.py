#!/usr/bin/env python3
"""
Migration: Remove email_verification_codes table
Removes table as verification codes are now stored in memory instead of database
"""

import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import OperationalError

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import DATABASE_URL

# Convert async database URL to sync for migrations
SYNC_DATABASE_URL = DATABASE_URL.replace('+aiosqlite', '').replace('+aiomysql', '+pymysql')


def migrate():
    """Drop email_verification_codes table if it exists"""
    print("Removing email_verification_codes table...")
    
    engine = create_engine(SYNC_DATABASE_URL, echo=False)
    inspector = inspect(engine)
    
    # Check if table exists
    if not inspector.has_table('email_verification_codes'):
        print("✅ Table email_verification_codes does not exist, skipping removal")
        return True
    
    try:
        with engine.begin() as conn:
            # Drop the table
            conn.execute(text("DROP TABLE IF EXISTS email_verification_codes"))
        
        print("✅ Successfully removed email_verification_codes table")
        return True
        
    except OperationalError as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False
    finally:
        engine.dispose()


def main():
    """Run migration"""
    success = migrate()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
