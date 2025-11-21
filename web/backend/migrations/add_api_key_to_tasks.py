#!/usr/bin/env python3
"""
Migration script to add api_key field to AnalysisRecord and ScheduledTask tables
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from web.backend.database import SessionLocal


def migrate():
    """Add api_key column to analysis_records and scheduled_tasks tables"""
    db = SessionLocal()
    
    try:
        print("🔄 Starting migration: add api_key fields...")
        
        # Check and add api_key to analysis_records
        print("\n1. Checking analysis_records table...")
        result = db.execute(text("""
            SELECT COUNT(*) as count 
            FROM pragma_table_info('analysis_records') 
            WHERE name='api_key'
        """))
        exists = result.scalar() > 0
        
        if not exists:
            print("   Adding api_key column to analysis_records...")
            db.execute(text("""
                ALTER TABLE analysis_records 
                ADD COLUMN api_key VARCHAR(255)
            """))
            db.commit()
            print("   ✅ Added api_key to analysis_records")
        else:
            print("   ✅ api_key already exists in analysis_records")
        
        # Check and add api_key to scheduled_tasks
        print("\n2. Checking scheduled_tasks table...")
        result = db.execute(text("""
            SELECT COUNT(*) as count 
            FROM pragma_table_info('scheduled_tasks') 
            WHERE name='api_key'
        """))
        exists = result.scalar() > 0
        
        if not exists:
            print("   Adding api_key column to scheduled_tasks...")
            db.execute(text("""
                ALTER TABLE scheduled_tasks 
                ADD COLUMN api_key VARCHAR(255)
            """))
            db.commit()
            print("   ✅ Added api_key to scheduled_tasks")
        else:
            print("   ✅ api_key already exists in scheduled_tasks")
        
        print("\n✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
