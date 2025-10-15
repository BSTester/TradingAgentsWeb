#!/usr/bin/env python3
"""
Database migration script for TradingAgents Web Interface
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# Add the project root to the path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import engine, SessionLocal
from web.backend.models import User, AnalysisRecord, AnalysisLog, ExportRecord
from sqlalchemy import text, inspect
import argparse

def check_table_exists(table_name):
    """
    Check if a table exists in the database
    """
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()

def check_column_exists(table_name, column_name):
    """
    Check if a column exists in a table
    """
    inspector = inspect(engine)
    if not check_table_exists(table_name):
        return False
    
    columns = inspector.get_columns(table_name)
    return any(col['name'] == column_name for col in columns)

def migrate_v1_to_v2():
    """
    Migration from v1 (no database) to v2 (with user authentication)
    """
    print("Running migration v1 -> v2: Adding user authentication tables")
    
    db = SessionLocal()
    try:
        # Check if users table exists
        if not check_table_exists("users"):
            print("Creating users table...")
            User.__table__.create(engine, checkfirst=True)
        
        # Check if analysis_records table exists
        if not check_table_exists("analysis_records"):
            print("Creating analysis_records table...")
            AnalysisRecord.__table__.create(engine, checkfirst=True)
        
        # Check if analysis_logs table exists
        if not check_table_exists("analysis_logs"):
            print("Creating analysis_logs table...")
            AnalysisLog.__table__.create(engine, checkfirst=True)
        
        # Check if export_records table exists
        if not check_table_exists("export_records"):
            print("Creating export_records table...")
            ExportRecord.__table__.create(engine, checkfirst=True)
        
        print("Migration v1 -> v2 completed successfully")
        
    except Exception as e:
        print(f"Error during migration v1 -> v2: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def migrate_v2_to_v3():
    """
    Future migration placeholder - add new columns or tables as needed
    """
    print("Running migration v2 -> v3: Future enhancements")
    
    db = SessionLocal()
    try:
        # Example: Add new column to existing table
        # if not check_column_exists("analysis_records", "new_column"):
        #     print("Adding new_column to analysis_records table...")
        #     db.execute(text("ALTER TABLE analysis_records ADD COLUMN new_column VARCHAR(255)"))
        #     db.commit()
        
        print("Migration v2 -> v3 completed successfully")
        
    except Exception as e:
        print(f"Error during migration v2 -> v3: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def get_current_version():
    """
    Get current database version
    """
    try:
        # Create version table if it doesn't exist
        if not check_table_exists("schema_version"):
            db = SessionLocal()
            try:
                db.execute(text("""
                    CREATE TABLE schema_version (
                        version INTEGER PRIMARY KEY,
                        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                db.execute(text("INSERT INTO schema_version (version) VALUES (1)"))
                db.commit()
                return 1
            except Exception:
                db.rollback()
                return 1
            finally:
                db.close()
        
        # Get current version
        db = SessionLocal()
        try:
            result = db.execute(text("SELECT MAX(version) FROM schema_version")).fetchone()
            return result[0] if result and result[0] else 1
        finally:
            db.close()
            
    except Exception:
        return 1

def set_version(version):
    """
    Set database version
    """
    db = SessionLocal()
    try:
        db.execute(text("INSERT INTO schema_version (version) VALUES (:version)"), {"version": version})
        db.commit()
    except Exception as e:
        print(f"Error setting version: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def run_migrations():
    """
    Run all pending migrations
    """
    current_version = get_current_version()
    print(f"Current database version: {current_version}")
    
    migrations = [
        (2, migrate_v1_to_v2),
        (3, migrate_v2_to_v3),
    ]
    
    for target_version, migration_func in migrations:
        if current_version < target_version:
            print(f"Running migration to version {target_version}...")
            migration_func()
            set_version(target_version)
            current_version = target_version
    
    print(f"Database is up to date (version {current_version})")

def main():
    """
    Main function to handle database migrations
    """
    parser = argparse.ArgumentParser(description="Run TradingAgents database migrations")
    parser.add_argument("--check", action="store_true", help="Check current database version")
    parser.add_argument("--force-version", type=int, help="Force set database version (use with caution)")
    
    args = parser.parse_args()
    
    try:
        if args.check:
            version = get_current_version()
            print(f"Current database version: {version}")
            return
        
        if args.force_version:
            print(f"Force setting database version to {args.force_version}")
            set_version(args.force_version)
            return
        
        print("Running database migrations...")
        run_migrations()
        print("Database migrations completed successfully!")
        
    except Exception as e:
        print(f"Error during database migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()