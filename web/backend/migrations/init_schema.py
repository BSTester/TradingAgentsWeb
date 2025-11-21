#!/usr/bin/env python3
"""
Initial Schema Migration
Creates all tables for TradingAgents Web Interface from scratch
This is the baseline migration for new installations
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text, inspect
from web.backend.database import DATABASE_URL

# Convert async database URL to sync
SYNC_DATABASE_URL = DATABASE_URL.replace('+aiosqlite', '').replace('+aiomysql', '')

def table_exists(engine, table_name):
    """Check if a table exists"""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()

def run_migration():
    """Create all tables from models"""
    print("=" * 60)
    print("Initial Schema Migration")
    print("=" * 60)
    
    # Detect database type
    if SYNC_DATABASE_URL.startswith("mysql"):
        db_type = "MySQL"
    elif SYNC_DATABASE_URL.startswith("sqlite"):
        db_type = "SQLite"
    else:
        db_type = "Unknown"
    
    print(f"Database Type: {db_type}")
    print(f"Database URL: {SYNC_DATABASE_URL.split('@')[-1] if '@' in SYNC_DATABASE_URL else SYNC_DATABASE_URL.split(':///')[-1]}")
    print()
    
    # Create engine
    engine = create_engine(SYNC_DATABASE_URL)
    
    # Import models to register them with Base
    from web.backend.models import (
        User, UserConfig, ScheduledTask, AnalysisRecord, 
        AnalysisLog, ExportRecord
    )
    from web.backend.database import Base
    
    # Check which tables already exist
    existing_tables = []
    tables_to_create = []
    
    for table_name in Base.metadata.tables.keys():
        if table_exists(engine, table_name):
            existing_tables.append(table_name)
        else:
            tables_to_create.append(table_name)
    
    if existing_tables:
        print(f"[INFO] Found {len(existing_tables)} existing tables:")
        for table in existing_tables:
            print(f"  - {table}")
        print()
    
    if tables_to_create:
        print(f"[INFO] Creating {len(tables_to_create)} new tables:")
        for table in tables_to_create:
            print(f"  - {table}")
        print()
        
        # Create all tables
        Base.metadata.create_all(engine)
        print("[OK] All tables created successfully")
    else:
        print("[INFO] All tables already exist, no action needed")
    
    print()
    print("=" * 60)
    print("[SUCCESS] Initial schema migration completed")
    print("=" * 60)

if __name__ == "__main__":
    try:
        run_migration()
        sys.exit(0)
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
