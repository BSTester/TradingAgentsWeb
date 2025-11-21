#!/usr/bin/env python3
"""
Add intraday LLM configuration fields to user_configs table
"""

from sqlalchemy import create_engine, Column, String
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from web.backend.database import Base, get_database_url
from web.backend.models import UserConfig


def add_intraday_llm_config_fields():
    """Add intraday LLM configuration fields to user_configs table"""
    
    database_url = get_database_url()
    engine = create_engine(database_url)
    
    # Check if we're using SQLite or PostgreSQL
    is_sqlite = database_url.startswith('sqlite')
    
    with engine.connect() as conn:
        try:
            # Add intraday_llm_provider column
            if is_sqlite:
                conn.execute("ALTER TABLE user_configs ADD COLUMN intraday_llm_provider VARCHAR(50)")
            else:
                conn.execute("ALTER TABLE user_configs ADD COLUMN intraday_llm_provider VARCHAR(50)")
            print("✅ Added intraday_llm_provider column")
        except Exception as e:
            print(f"⚠️  intraday_llm_provider column may already exist: {e}")
        
        try:
            # Add intraday_api_key column
            if is_sqlite:
                conn.execute("ALTER TABLE user_configs ADD COLUMN intraday_api_key VARCHAR(255)")
            else:
                conn.execute("ALTER TABLE user_configs ADD COLUMN intraday_api_key VARCHAR(255)")
            print("✅ Added intraday_api_key column")
        except Exception as e:
            print(f"⚠️  intraday_api_key column may already exist: {e}")
        
        try:
            # Add intraday_backend_url column
            if is_sqlite:
                conn.execute("ALTER TABLE user_configs ADD COLUMN intraday_backend_url VARCHAR(255)")
            else:
                conn.execute("ALTER TABLE user_configs ADD COLUMN intraday_backend_url VARCHAR(255)")
            print("✅ Added intraday_backend_url column")
        except Exception as e:
            print(f"⚠️  intraday_backend_url column may already exist: {e}")
        
        conn.commit()
    
    print("✅ Migration completed successfully")


if __name__ == "__main__":
    add_intraday_llm_config_fields()
