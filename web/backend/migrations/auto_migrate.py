#!/usr/bin/env python3
"""
Auto Migration Manager
Automatically runs pending database migrations on application startup
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from sqlalchemy import create_engine, text, Column, String, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import DATABASE_URL

# Convert async database URL to sync for migrations
SYNC_DATABASE_URL = DATABASE_URL.replace('+aiosqlite', '').replace('+aiomysql', '')

# Create a separate base for migration tracking
Base = declarative_base()

class MigrationHistory(Base):
    """Track applied migrations"""
    __tablename__ = "migration_history"
    
    migration_name = Column(String(255), primary_key=True)
    applied_at = Column(DateTime, nullable=False)
    description = Column(String(500), nullable=True)

# Define migrations in order
# This is the baseline migration list for the current version
MIGRATIONS = [
    {
        "name": "init_schema",
        "file": "init_schema.py",
        "description": "Initialize database schema (all tables)"
    },
    # Future migrations will be added here
    # Example:
    # {
    #     "name": "add_new_feature",
    #     "file": "add_new_feature.py",
    #     "description": "Add new feature to the system"
    # },
]

def create_migration_history_table(engine):
    """Create migration_history table if it doesn't exist"""
    Base.metadata.create_all(engine)

def get_applied_migrations(session):
    """Get list of already applied migrations"""
    try:
        result = session.query(MigrationHistory.migration_name).all()
        return {row[0] for row in result}
    except Exception:
        # Table might not exist yet
        return set()

def mark_migration_applied(session, migration_name, description):
    """Mark a migration as applied"""
    migration = MigrationHistory(
        migration_name=migration_name,
        applied_at=datetime.utcnow(),
        description=description
    )
    session.add(migration)
    session.commit()

def run_migration(migration_file):
    """Run a single migration file"""
    migration_path = Path(__file__).parent / migration_file
    
    if not migration_path.exists():
        print(f"   ⚠️  Migration file not found: {migration_file}")
        return False
    
    try:
        # Execute the migration as a subprocess
        import subprocess
        result = subprocess.run(
            [sys.executable, str(migration_path)],
            capture_output=True,
            text=True,
            timeout=60  # 60 second timeout
        )
        
        # Print output
        if result.stdout:
            for line in result.stdout.strip().split('\n'):
                if line.strip():  # Skip empty lines
                    print(f"   {line}")
        
        if result.returncode == 0:
            return True
        else:
            print(f"   ❌ Migration failed with exit code {result.returncode}")
            if result.stderr:
                print(f"   Error: {result.stderr}")
            return False
    
    except subprocess.TimeoutExpired:
        print(f"   ❌ Migration timed out after 60 seconds")
        return False
    except Exception as e:
        print(f"   ❌ Error running migration: {e}")
        return False

def auto_migrate(verbose=True):
    """
    Automatically run pending migrations
    
    Args:
        verbose: Whether to print detailed output
        
    Returns:
        tuple: (success_count, failed_count, skipped_count)
    """
    # Set UTF-8 encoding for Windows console
    if sys.platform == 'win32':
        try:
            import io
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        except Exception:
            pass
    
    if verbose:
        print("=" * 60)
        print("Auto Migration Manager")
        print("=" * 60)
    
    # Create engine and session (use sync URL)
    engine = create_engine(SYNC_DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create migration history table
        create_migration_history_table(engine)
        
        # Get applied migrations
        applied = get_applied_migrations(session)
        
        if verbose:
            print(f"Database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL.split(':///')[-1]}")
            print(f"Applied migrations: {len(applied)}")
            print()
        
        success_count = 0
        failed_count = 0
        skipped_count = 0
        
        for migration in MIGRATIONS:
            name = migration["name"]
            file = migration["file"]
            description = migration["description"]
            
            if name in applied:
                if verbose:
                    print(f"[SKIP] {name} (already applied)")
                skipped_count += 1
                continue
            
            if verbose:
                print(f"[RUN] {name}")
                print(f"      {description}")
            
            # Run the migration
            success = run_migration(file)
            
            if success:
                # Mark as applied
                mark_migration_applied(session, name, description)
                success_count += 1
                if verbose:
                    print(f"      [OK] Migration completed successfully")
            else:
                failed_count += 1
                if verbose:
                    print(f"      [FAIL] Migration failed")
            
            if verbose:
                print()
        
        # Summary
        if verbose:
            print("=" * 60)
            print("Migration Summary")
            print("=" * 60)
            print(f"[OK] Successful: {success_count}")
            print(f"[FAIL] Failed: {failed_count}")
            print(f"[SKIP] Skipped: {skipped_count}")
            print(f"Total: {len(MIGRATIONS)}")
            print()
            
            if failed_count == 0:
                if success_count > 0:
                    print("[SUCCESS] All pending migrations completed successfully!")
                else:
                    print("[INFO] Database is up to date!")
            else:
                print("[WARNING] Some migrations failed. Please check the errors above.")
        
        return success_count, failed_count, skipped_count
    
    finally:
        session.close()
        engine.dispose()

def main():
    """Run auto migration from command line"""
    success, failed, skipped = auto_migrate(verbose=True)
    
    if failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
