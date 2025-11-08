#!/usr/bin/env python3
"""
Test script to verify intraday trading models can be created successfully
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from web.backend.database import init_db_sync, Base, sync_engine
from web.backend.models import (
    User, PositionRecord, TradingHistory, IntradayDecisionRecord
)
from sqlalchemy import inspect

def test_models():
    """Test that all intraday trading models are properly defined"""
    print("Testing intraday trading models...")
    
    # Initialize database
    print("\n1. Initializing database...")
    init_db_sync()
    
    # Verify tables exist
    print("\n2. Verifying tables exist...")
    inspector = inspect(sync_engine)
    tables = inspector.get_table_names()
    
    required_tables = [
        'position_records',
        'trading_history',
        'intraday_decision_records'
    ]
    
    for table in required_tables:
        if table in tables:
            print(f"   ✅ Table '{table}' exists")
            
            # Show columns
            columns = inspector.get_columns(table)
            print(f"      Columns: {', '.join([col['name'] for col in columns])}")
            
            # Show indexes
            indexes = inspector.get_indexes(table)
            if indexes:
                print(f"      Indexes: {', '.join([idx['name'] for idx in indexes])}")
        else:
            print(f"   ❌ Table '{table}' NOT FOUND")
            return False
    
    # Verify relationships
    print("\n3. Verifying model relationships...")
    
    # Check User relationships
    user_relationships = [rel.key for rel in User.__mapper__.relationships]
    if 'position_records' in user_relationships:
        print("   ✅ User -> PositionRecord relationship exists")
    else:
        print("   ❌ User -> PositionRecord relationship NOT FOUND")
        return False
    
    if 'intraday_decisions' in user_relationships:
        print("   ✅ User -> IntradayDecisionRecord relationship exists")
    else:
        print("   ❌ User -> IntradayDecisionRecord relationship NOT FOUND")
        return False
    
    # Check PositionRecord relationships
    position_relationships = [rel.key for rel in PositionRecord.__mapper__.relationships]
    if 'trading_history' in position_relationships:
        print("   ✅ PositionRecord -> TradingHistory relationship exists")
    else:
        print("   ❌ PositionRecord -> TradingHistory relationship NOT FOUND")
        return False
    
    print("\n✅ All tests passed! Intraday trading models are properly configured.")
    return True

if __name__ == "__main__":
    success = test_models()
    sys.exit(0 if success else 1)
