#!/usr/bin/env python3
"""
Run all database migrations in order
Supports both SQLite (development) and MySQL (production)
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import DATABASE_URL

def main():
    """Run all migrations in order"""
    print("=" * 60)
    print("🚀 Running Database Migrations")
    print("=" * 60)
    
    # Detect database type
    if DATABASE_URL.startswith("mysql"):
        db_type = "MySQL (Production)"
    elif DATABASE_URL.startswith("sqlite"):
        db_type = "SQLite (Development)"
    else:
        db_type = "Unknown"
    
    print(f"📊 Database Type: {db_type}")
    print(f"📍 Database URL: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL.split(':///')[-1]}")
    print()
    
    # List of migrations to run in order
    migrations = [
        ("add_user_config.py", "Create user_configs table"),
        ("add_api_keys_to_user_config.py", "Add API key fields to user_configs"),
        ("fix_scheduled_tasks.py", "Add trading executor fields to scheduled_tasks"),
    ]
    
    success_count = 0
    failed_count = 0
    
    for migration_file, description in migrations:
        print(f"📦 Running: {migration_file}")
        print(f"   {description}")
        print("-" * 60)
        
        try:
            # Import and run the migration
            migration_path = Path(__file__).parent / migration_file
            if not migration_path.exists():
                print(f"   ⚠️  Migration file not found: {migration_file}")
                failed_count += 1
                continue
            
            # Execute the migration
            import subprocess
            result = subprocess.run(
                [sys.executable, str(migration_path)],
                capture_output=True,
                text=True
            )
            
            # Print output
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    print(f"   {line}")
            
            if result.returncode == 0:
                success_count += 1
            else:
                print(f"   ❌ Migration failed with exit code {result.returncode}")
                if result.stderr:
                    print(f"   Error: {result.stderr}")
                failed_count += 1
        
        except Exception as e:
            print(f"   ❌ Error running migration: {e}")
            failed_count += 1
        
        print()
    
    # Summary
    print("=" * 60)
    print("📊 Migration Summary")
    print("=" * 60)
    print(f"✅ Successful: {success_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"📝 Total: {len(migrations)}")
    print()
    
    if failed_count == 0:
        print("🎉 All migrations completed successfully!")
        return 0
    else:
        print("⚠️  Some migrations failed. Please check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
