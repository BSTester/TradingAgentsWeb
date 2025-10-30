#!/usr/bin/env python3
"""
Migration script to fill the market field for existing analysis records
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from database import engine
from models import AnalysisRecord
from utils.market_detector import detect_market, normalize_ticker
from sqlalchemy.orm import sessionmaker

def fill_market_field():
    """
    Fill the market field for all existing analysis records
    """
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Get all records where market is NULL
        records = db.query(AnalysisRecord).filter(AnalysisRecord.market == None).all()
        
        if not records:
            print("No records found with NULL market field")
            return
        
        print(f"Found {len(records)} records to update")
        
        updated_count = 0
        for record in records:
            try:
                # Normalize and detect market
                normalized_ticker = normalize_ticker(record.ticker)
                market = detect_market(normalized_ticker)
                
                # Update the record
                record.market = market
                record.ticker = normalized_ticker  # Also normalize the ticker
                
                updated_count += 1
                print(f"Updated record {record.id}: {record.ticker} -> {market}")
                
            except Exception as e:
                print(f"Error updating record {record.id}: {e}")
                continue
        
        # Commit all changes
        db.commit()
        print(f"\nSuccessfully updated {updated_count} records")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def main():
    """
    Main function to run the migration
    """
    try:
        print("Starting market field migration...")
        fill_market_field()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
