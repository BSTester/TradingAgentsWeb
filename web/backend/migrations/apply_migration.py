#!/usr/bin/env python3
"""
Apply database migration to add company_name field
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from web.backend.database import engine

def apply_migration():
    """Apply the add_company_name migration"""
    migration_file = Path(__file__).parent / 'add_company_name.sql'
    
    print(f"📋 Reading migration file: {migration_file}")
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    print("🔄 Applying migration...")
    
    try:
        with engine.connect() as conn:
            # Execute the SQL
            conn.execute(text(sql))
            conn.commit()
        
        print("✅ Migration applied successfully!")
        print("\n📊 Changes:")
        print("  - Added 'company_name' column to analysis_records table")
        print("  - Created index on company_name for better query performance")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("Database Migration: Add Company Name Field")
    print("=" * 60)
    print()
    
    apply_migration()
    
    print()
    print("=" * 60)
    print("Migration Complete!")
    print("=" * 60)
