#!/usr/bin/env python3
"""
Simple migration runner that uses init_db to update schema
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))
os.chdir(project_root)

from web.backend.database import init_db, SessionLocal
from web.backend.models import AnalysisRecord
from web.backend.utils.market_detector import detect_market


def fill_market_values():
    """Fill market values for existing records"""
    print("📝 Filling market values for existing records...")
    
    db = SessionLocal()
    try:
        # Get all records without market value
        records = db.query(AnalysisRecord).filter(
            (AnalysisRecord.market == None) | (AnalysisRecord.market == '')
        ).all()
        
        if not records:
            print("ℹ️  No records to update")
            return
        
        print(f"📊 Found {len(records)} records to update")
        
        # Update each record
        updated_count = 0
        for record in records:
            try:
                record.market = detect_market(record.ticker)
                updated_count += 1
                
                if updated_count % 10 == 0:
                    print(f"   Updated {updated_count}/{len(records)} records...")
                    
            except Exception as e:
                print(f"⚠️  Error updating record {record.analysis_id}: {e}")
                continue
        
        db.commit()
        print(f"✅ Successfully updated {updated_count} records")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error filling market values: {e}")
        raise
    finally:
        db.close()


def verify_migration():
    """Verify migration was successful"""
    print("📝 Verifying migration...")
    
    db = SessionLocal()
    try:
        # Count total records
        total = db.query(AnalysisRecord).count()
        
        # Count records with market value
        with_market = db.query(AnalysisRecord).filter(
            (AnalysisRecord.market != None) & (AnalysisRecord.market != '')
        ).count()
        
        print(f"📊 Migration verification:")
        print(f"   Total records: {total}")
        print(f"   Records with market: {with_market}")
        
        if with_market < total:
            print(f"⚠️  Warning: {total - with_market} records still without market value")
        else:
            print("✅ All records have market values")
            
    except Exception as e:
        print(f"❌ Error verifying migration: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Starting market field migration")
    print("=" * 60)
    
    try:
        # Step 1: Update schema (init_db will create new columns)
        print("📝 Updating database schema...")
        init_db()
        
        # Step 2: Fill values
        fill_market_values()
        
        # Step 3: Verify
        verify_migration()
        
        print("=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print("=" * 60)
        print(f"❌ Migration failed: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        sys.exit(1)
