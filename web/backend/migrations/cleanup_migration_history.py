#!/usr/bin/env python3
"""
Cleanup Migration History
Removes old migration records and keeps only the current baseline
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from web.backend.database import DATABASE_URL

# Convert async database URL to sync
SYNC_DATABASE_URL = DATABASE_URL.replace('+aiosqlite', '').replace('+aiomysql', '')

def cleanup_migration_history():
    """Remove old migration records"""
    print("=" * 60)
    print("Cleanup Migration History")
    print("=" * 60)
    
    engine = create_engine(SYNC_DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if migration_history table exists
        if SYNC_DATABASE_URL.startswith("sqlite"):
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_history'"))
        else:
            result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name='migration_history'"))
        
        if not result.fetchone():
            print("[INFO] migration_history table does not exist")
            print("[INFO] No cleanup needed")
            return
        
        # Get current migration records
        result = conn.execute(text("SELECT migration_name FROM migration_history"))
        current_migrations = [row[0] for row in result.fetchall()]
        
        print(f"[INFO] Found {len(current_migrations)} migration records:")
        for migration in current_migrations:
            print(f"  - {migration}")
        print()
        
        # Define migrations to keep (current baseline)
        migrations_to_keep = ['init_schema']
        
        # Find migrations to remove
        migrations_to_remove = [m for m in current_migrations if m not in migrations_to_keep]
        
        if not migrations_to_remove:
            print("[INFO] No old migrations to remove")
            print("[INFO] Migration history is clean")
            return
        
        print(f"[INFO] Removing {len(migrations_to_remove)} old migration records:")
        for migration in migrations_to_remove:
            print(f"  - {migration}")
        print()
        
        # Remove old migrations
        for migration in migrations_to_remove:
            conn.execute(text("DELETE FROM migration_history WHERE migration_name = :name"), {"name": migration})
        
        conn.commit()
        
        print("[OK] Migration history cleaned up successfully")
        print()
        
        # Show remaining migrations
        result = conn.execute(text("SELECT migration_name FROM migration_history"))
        remaining = [row[0] for row in result.fetchall()]
        
        print(f"[INFO] Remaining migrations: {len(remaining)}")
        for migration in remaining:
            print(f"  - {migration}")
    
    print()
    print("=" * 60)
    print("[SUCCESS] Cleanup completed")
    print("=" * 60)

if __name__ == "__main__":
    try:
        cleanup_migration_history()
        sys.exit(0)
    except Exception as e:
        print(f"[ERROR] Cleanup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
