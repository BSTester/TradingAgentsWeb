"""
Apply migration 001: Increase version column length
Run this script to update the database schema
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from database import SQLALCHEMY_DATABASE_URL

def apply_migration():
    """Apply the migration to increase version column length"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    migration_sql = """
    ALTER TABLE agent_prompt_templates MODIFY COLUMN version VARCHAR(50) NOT NULL DEFAULT '1.0';
    """
    
    try:
        with engine.connect() as conn:
            print("Applying migration: Increase version column length from VARCHAR(20) to VARCHAR(50)")
            conn.execute(text(migration_sql))
            conn.commit()
            print("✓ Migration applied successfully!")
            
            # Verify the change
            result = conn.execute(text("""
                SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'agent_prompt_templates' AND COLUMN_NAME = 'version'
            """))
            row = result.fetchone()
            if row:
                print(f"✓ Verified: version column is now {row[1]}({row[2]})")
            
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    apply_migration()
