#!/usr/bin/env python3
"""
Migration script to add scheduled_tasks table to existing database
Run this script to add the scheduled_tasks table without dropping existing data
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy import create_engine, inspect, text
from web.backend.database import DATABASE_URL, Base
from web.backend.models import ScheduledTask

def get_sync_database_url(async_url: str) -> str:
    """Convert async database URL to sync URL"""
    if async_url.startswith("mysql+aiomysql"):
        return async_url.replace("+aiomysql", "+pymysql")
    elif async_url.startswith("sqlite+aiosqlite"):
        return async_url.replace("+aiosqlite", "")
    return async_url

def table_exists(engine, table_name: str) -> bool:
    """Check if a table exists in the database"""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()

def run_migration():
    """Run the migration to add scheduled_tasks table"""
    print("🔄 Starting migration: add_scheduled_tasks_table")
    print(f"📊 Database URL: {DATABASE_URL}")
    
    # Get sync database URL
    sync_url = get_sync_database_url(DATABASE_URL)
    
    # Create sync engine
    engine = create_engine(
        sync_url,
        connect_args={"check_same_thread": False} if "sqlite" in sync_url else {},
        echo=True
    )
    
    # Check if table already exists
    if table_exists(engine, "scheduled_tasks"):
        print("⚠️  Table 'scheduled_tasks' already exists. Skipping migration.")
        return
    
    # Create the scheduled_tasks table
    print("✨ Creating scheduled_tasks table...")
    ScheduledTask.__table__.create(engine)
    
    print("✅ Migration completed successfully!")
    print("📋 Created table: scheduled_tasks")
    
    # Verify table was created
    if table_exists(engine, "scheduled_tasks"):
        print("✅ Verification passed: scheduled_tasks table exists")
    else:
        print("❌ Verification failed: scheduled_tasks table not found")
        sys.exit(1)

def rollback_migration():
    """Rollback the migration (drop scheduled_tasks table)"""
    print("🔄 Rolling back migration: add_scheduled_tasks_table")
    print(f"📊 Database URL: {DATABASE_URL}")
    
    # Get sync database URL
    sync_url = get_sync_database_url(DATABASE_URL)
    
    # Create sync engine
    engine = create_engine(
        sync_url,
        connect_args={"check_same_thread": False} if "sqlite" in sync_url else {},
        echo=True
    )
    
    # Check if table exists
    if not table_exists(engine, "scheduled_tasks"):
        print("⚠️  Table 'scheduled_tasks' does not exist. Nothing to rollback.")
        return
    
    # Drop the scheduled_tasks table
    print("🗑️  Dropping scheduled_tasks table...")
    ScheduledTask.__table__.drop(engine)
    
    print("✅ Rollback completed successfully!")
    
    # Verify table was dropped
    if not table_exists(engine, "scheduled_tasks"):
        print("✅ Verification passed: scheduled_tasks table removed")
    else:
        print("❌ Verification failed: scheduled_tasks table still exists")
        sys.exit(1)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate database to add scheduled_tasks table")
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Rollback the migration (drop scheduled_tasks table)"
    )
    
    args = parser.parse_args()
    
    try:
        if args.rollback:
            rollback_migration()
        else:
            run_migration()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
