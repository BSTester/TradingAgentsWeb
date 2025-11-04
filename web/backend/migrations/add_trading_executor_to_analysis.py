#!/usr/bin/env python3
"""
Migration: Add trading executor fields to analysis_records table
"""

from sqlalchemy import create_engine, text, Column, Boolean, String
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path

# Get database URL from environment or use default SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/tradingagents.db")

def run_migration():
    """Add enable_trading_executor, futu_api_base_url, and futu_api_key columns to analysis_records table"""
    
    print("🔄 Starting migration: Add trading executor fields to analysis_records")
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if we're using SQLite or PostgreSQL
        if "sqlite" in DATABASE_URL.lower():
            # SQLite
            print("📊 Detected SQLite database")
            
            # Check if columns already exist
            result = conn.execute(text("PRAGMA table_info(analysis_records)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'enable_trading_executor' not in columns:
                print("➕ Adding enable_trading_executor column...")
                conn.execute(text(
                    "ALTER TABLE analysis_records ADD COLUMN enable_trading_executor BOOLEAN DEFAULT 0 NOT NULL"
                ))
                conn.commit()
                print("✅ Added enable_trading_executor column")
            else:
                print("⏭️  enable_trading_executor column already exists")
            
            if 'futu_api_base_url' not in columns:
                print("➕ Adding futu_api_base_url column...")
                conn.execute(text(
                    "ALTER TABLE analysis_records ADD COLUMN futu_api_base_url VARCHAR(255)"
                ))
                conn.commit()
                print("✅ Added futu_api_base_url column")
            else:
                print("⏭️  futu_api_base_url column already exists")
            
            if 'futu_api_key' not in columns:
                print("➕ Adding futu_api_key column...")
                conn.execute(text(
                    "ALTER TABLE analysis_records ADD COLUMN futu_api_key VARCHAR(255)"
                ))
                conn.commit()
                print("✅ Added futu_api_key column")
            else:
                print("⏭️  futu_api_key column already exists")
                
        else:
            # PostgreSQL
            print("📊 Detected PostgreSQL database")
            
            # Check if columns already exist
            result = conn.execute(text(
                """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'analysis_records'
                """
            ))
            columns = [row[0] for row in result.fetchall()]
            
            if 'enable_trading_executor' not in columns:
                print("➕ Adding enable_trading_executor column...")
                conn.execute(text(
                    "ALTER TABLE analysis_records ADD COLUMN enable_trading_executor BOOLEAN DEFAULT FALSE NOT NULL"
                ))
                conn.commit()
                print("✅ Added enable_trading_executor column")
            else:
                print("⏭️  enable_trading_executor column already exists")
            
            if 'futu_api_base_url' not in columns:
                print("➕ Adding futu_api_base_url column...")
                conn.execute(text(
                    "ALTER TABLE analysis_records ADD COLUMN futu_api_base_url VARCHAR(255)"
                ))
                conn.commit()
                print("✅ Added futu_api_base_url column")
            else:
                print("⏭️  futu_api_base_url column already exists")
            
            if 'futu_api_key' not in columns:
                print("➕ Adding futu_api_key column...")
                conn.execute(text(
                    "ALTER TABLE analysis_records ADD COLUMN futu_api_key VARCHAR(255)"
                ))
                conn.commit()
                print("✅ Added futu_api_key column")
            else:
                print("⏭️  futu_api_key column already exists")
    
    print("✅ Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
