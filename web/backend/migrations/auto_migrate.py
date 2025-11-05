#!/usr/bin/env python3
"""
Auto Migration Manager
Automatically runs pending database migrations on application startup
Compares table schemas and adds missing columns
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from sqlalchemy import create_engine, text, Column, String, DateTime, inspect, Table, MetaData
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError, ProgrammingError

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import DATABASE_URL

# Convert async database URL to sync for migrations
SYNC_DATABASE_URL = DATABASE_URL.replace('+aiosqlite', '').replace('+aiomysql', '+pymysql')

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

def get_column_type_sql(column, dialect_name):
    """Generate SQL type string for a column based on dialect"""
    col_type = column.type
    type_name = str(col_type)
    
    # Handle common types
    if 'VARCHAR' in type_name or 'String' in str(type(col_type)):
        length = getattr(col_type, 'length', 255)
        return f"VARCHAR({length})"
    elif 'TEXT' in type_name or 'Text' in str(type(col_type)):
        return "TEXT"
    elif 'INTEGER' in type_name or 'Integer' in str(type(col_type)):
        return "INTEGER"
    elif 'FLOAT' in type_name or 'Float' in str(type(col_type)):
        return "FLOAT"
    elif 'BOOLEAN' in type_name or 'Boolean' in str(type(col_type)):
        if dialect_name == 'mysql':
            return "TINYINT(1)"
        return "BOOLEAN"
    elif 'DATETIME' in type_name or 'DateTime' in str(type(col_type)):
        return "DATETIME"
    elif 'JSON' in type_name or 'JSON' in str(type(col_type)):
        if dialect_name == 'mysql':
            return "JSON"
        return "TEXT"  # SQLite doesn't have native JSON
    else:
        return str(col_type)

def compare_and_sync_schema(engine, verbose=True):
    """
    Compare model schema with database schema and add missing columns
    
    Args:
        engine: SQLAlchemy engine
        verbose: Whether to print detailed output
        
    Returns:
        tuple: (columns_added, errors)
    """
    from web.backend.models import User, UserConfig, AnalysisRecord, AnalysisLog, ExportRecord, ScheduledTask
    from web.backend.database import Base
    
    inspector = inspect(engine)
    metadata = Base.metadata
    dialect_name = engine.dialect.name
    
    columns_added = 0
    errors = 0
    
    if verbose:
        print("\n[SCHEMA SYNC] Comparing database schema with models...")
    
    # Get all tables from models
    for table_name, table in metadata.tables.items():
        # Check if table exists
        if not inspector.has_table(table_name):
            if verbose:
                print(f"   ⚠️  Table '{table_name}' does not exist, skipping column sync")
            continue
        
        # Get existing columns in database
        existing_columns = {col['name']: col for col in inspector.get_columns(table_name)}
        
        # Compare with model columns
        for column in table.columns:
            col_name = column.name
            
            if col_name not in existing_columns:
                # Column is missing, add it
                try:
                    col_type_sql = get_column_type_sql(column, dialect_name)
                    
                    # Build ALTER TABLE statement
                    nullable = "NULL" if column.nullable else "NOT NULL"
                    default_clause = ""
                    
                    # Handle default values
                    if column.default is not None:
                        if hasattr(column.default, 'arg'):
                            default_val = column.default.arg
                            if isinstance(default_val, str):
                                default_clause = f" DEFAULT '{default_val}'"
                            elif isinstance(default_val, bool):
                                default_clause = f" DEFAULT {1 if default_val else 0}"
                            elif isinstance(default_val, (int, float)):
                                default_clause = f" DEFAULT {default_val}"
                    
                    # For MySQL, handle server_default
                    if dialect_name == 'mysql' and column.server_default is not None:
                        if 'now()' in str(column.server_default).lower() or 'current_timestamp' in str(column.server_default).lower():
                            default_clause = " DEFAULT CURRENT_TIMESTAMP"
                    
                    alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type_sql}{default_clause} {nullable}"
                    
                    if verbose:
                        print(f"   [ADD] {table_name}.{col_name} ({col_type_sql})")
                    
                    with engine.begin() as conn:
                        conn.execute(text(alter_sql))
                    
                    columns_added += 1
                    
                except (OperationalError, ProgrammingError) as e:
                    if verbose:
                        print(f"   ❌ Failed to add column {table_name}.{col_name}: {e}")
                    errors += 1
                except Exception as e:
                    if verbose:
                        print(f"   ❌ Unexpected error adding column {table_name}.{col_name}: {e}")
                    errors += 1
    
    if verbose:
        if columns_added > 0:
            print(f"   ✅ Added {columns_added} missing column(s)")
        else:
            print(f"   ✅ Schema is up to date")
    
    return columns_added, errors

def auto_migrate(verbose=True):
    """
    Automatically run pending migrations and sync schema
    
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
    engine = create_engine(SYNC_DATABASE_URL, echo=False)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create migration history table
        create_migration_history_table(engine)
        
        # Get applied migrations
        applied = get_applied_migrations(session)
        
        if verbose:
            db_display = DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL.split(':///')[-1]
            print(f"Database: {db_display}")
            print(f"Driver: {engine.dialect.name}")
            print(f"Applied migrations: {len(applied)}")
            print()
        
        success_count = 0
        failed_count = 0
        skipped_count = 0
        
        # Run file-based migrations
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
        
        # Run schema comparison and sync
        columns_added, schema_errors = compare_and_sync_schema(engine, verbose)
        
        if schema_errors > 0:
            failed_count += schema_errors
        
        # Summary
        if verbose:
            print("=" * 60)
            print("Migration Summary")
            print("=" * 60)
            print(f"[OK] Successful: {success_count}")
            print(f"[OK] Columns added: {columns_added}")
            print(f"[FAIL] Failed: {failed_count}")
            print(f"[SKIP] Skipped: {skipped_count}")
            print(f"Total migrations: {len(MIGRATIONS)}")
            print()
            
            if failed_count == 0:
                if success_count > 0 or columns_added > 0:
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
