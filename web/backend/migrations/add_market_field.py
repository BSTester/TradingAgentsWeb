#!/usr/bin/env python3
"""
Database migration script to add market field to AnalysisRecord table
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

# Change to project root directory for database file access
os.chdir(project_root)

from sqlalchemy import text
from web.backend.database import SessionLocal, engine
from web.backend.models import AnalysisRecord
from web.backend.utils.market_detector import detect_market


def add_market_column():
    """Add market column to analysis_records table"""
    print("📝 Adding market column to analysis_records table...")
    
    with engine.connect() as conn:
        try:
            # Check if column already exists
            result = conn.execute(text(
                "SELECT COUNT(*) FROM pragma_table_info('analysis_records') WHERE name='market'"
            ))
            exists = result.scalar() > 0
            
            if exists:
                print("ℹ️  Market column already exists, skipping creation")
            else:
                # Add the column
                conn.execute(text(
                    "ALTER TABLE analysis_records ADD COLUMN market VARCHAR(10)"
                ))
                conn.commit()
                print("✅ Market column added successfully")
                
        except Exception as e:
            print(f"❌ Error adding market column: {e}")
            raise


def create_market_index():
    """Create index on market column"""
    print("📝 Creating index on market column...")
    
    with engine.connect() as conn:
        try:
            # Check if index already exists
            result = conn.execute(text(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='ix_analysis_records_market'"
            ))
            exists = result.scalar() > 0
            
            if exists:
                print("ℹ️  Market index already exists, skipping creation")
            else:
                # Create the index
                conn.execute(text(
                    "CREATE INDEX ix_analysis_records_market ON analysis_records (market)"
                ))
                conn.commit()
                print("✅ Market index created successfully")
                
        except Exception as e:
            print(f"❌ Error creating market index: {e}")
            raise


def fill_market_values():
    """Fill market values for existing records"""
    print("📝 Filling market values for existing records...")
    
    db = SessionLocal()
    try:
        # Get all records without market value
        records = db.query(AnalysisRecord).filter(
            AnalysisRecord.market == None
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
                
                if updated_count % 100 == 0:
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
            AnalysisRecord.market != None
        ).count()
        
        # Count records without market value
        without_market = db.query(AnalysisRecord).filter(
            AnalysisRecord.market == None
        ).count()
        
        print(f"📊 Migration verification:")
        print(f"   Total records: {total}")
        print(f"   Records with market: {with_market}")
        print(f"   Records without market: {without_market}")
        
        if without_market > 0:
            print(f"⚠️  Warning: {without_market} records still without market value")
        else:
            print("✅ All records have market values")
            
    except Exception as e:
        print(f"❌ Error verifying migration: {e}")
        raise
    finally:
        db.close()


def migrate():
    """Run the complete migration"""
    print("=" * 60)
    print("🚀 Starting market field migration")
    print("=" * 60)
    
    try:
        # Step 1: Add column
        add_market_column()
        
        # Step 2: Create index
        create_market_index()
        
        # Step 3: Fill values
        fill_market_values()
        
        # Step 4: Verify
        verify_migration()
        
        print("=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print("=" * 60)
        print(f"❌ Migration failed: {e}")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    migrate()
