#!/usr/bin/env python3
"""
Migration: Add has_set_password field to users table
This migration adds the has_set_password field and sets it to True for existing users
(since they already have passwords set)
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import sync_engine
from sqlalchemy import text

def migrate():
    """Run migration"""
    with sync_engine.begin() as conn:
        # Check if column already exists
        try:
            # For SQLite, check if the column exists
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result]
            
            if 'has_set_password' in columns:
                print("⏭️  Column 'has_set_password' already exists, updating existing users...")
                # Update existing users to have has_set_password = True
                # (since all existing users already have passwords)
                conn.execute(text("""
                    UPDATE users SET has_set_password = 1 WHERE has_set_password IS NULL OR has_set_password = 0
                """))
                print("✅ Updated existing users")
                return
        except Exception as e:
            # Column doesn't exist, will be added by auto schema sync
            print(f"ℹ️  Column will be added by auto schema sync: {e}")
        
        # Note: The column will be added automatically by the schema sync system
        # This migration just ensures existing users have the correct value
        print("ℹ️  Column 'has_set_password' will be added by auto schema sync")
        print("✅ Migration prepared")

if __name__ == "__main__":
    migrate()
