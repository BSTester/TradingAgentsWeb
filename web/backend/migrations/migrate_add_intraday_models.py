#!/usr/bin/env python3
"""
Migration script to add intraday_llm_model column to user_configs table.

Usage:
    python web/backend/migrations/migrate_add_intraday_models.py
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy import create_engine, text, inspect
import os

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/tradingagents.db")
# Convert async URL to sync URL for migration
if DATABASE_URL.startswith("sqlite+aiosqlite"):
    DATABASE_URL = DATABASE_URL.replace("sqlite+aiosqlite", "sqlite")
elif DATABASE_URL.startswith("mysql+aiomysql"):
    DATABASE_URL = DATABASE_URL.replace("mysql+aiomysql", "mysql+pymysql")

def run_migration():
    """Run the migration to add new column"""
    print("Starting migration: Add intraday LLM model field...")
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Check if column already exists
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('user_configs')]
    
    with engine.begin() as conn:
        # Add intraday_llm_model if not exists
        if 'intraday_llm_model' not in columns:
            print("Adding column: intraday_llm_model")
            conn.execute(text(
                "ALTER TABLE user_configs ADD COLUMN intraday_llm_model VARCHAR(100)"
            ))
            print("✓ Column intraday_llm_model added")
        else:
            print("✓ Column intraday_llm_model already exists")
    
    print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    try:
        run_migration()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
