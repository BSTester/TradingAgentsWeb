#!/usr/bin/env python3
"""
Database migration script to add new fields to AnalysisRecord table
"""

import os
from sqlalchemy import create_engine, text

def migrate():
    """Add new fields to analysis_records table"""
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tradingagents.db")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # For SQLite, check columns using PRAGMA
        result = conn.execute(text("PRAGMA table_info(analysis_records)"))
        columns = [row[1] for row in result.fetchall()]
        
        # Check and add final_summary column
        if 'final_summary' not in columns:
            print("Adding final_summary column...")
            try:
                conn.execute(text("ALTER TABLE analysis_records ADD COLUMN final_summary TEXT"))
                conn.commit()
                print("✓ Added final_summary column")
            except Exception as e:
                print(f"✗ Failed to add final_summary: {e}")
        else:
            print("✓ final_summary column already exists")
        
        # Check and add phases column
        if 'phases' not in columns:
            print("Adding phases column...")
            try:
                conn.execute(text("ALTER TABLE analysis_records ADD COLUMN phases JSON"))
                conn.commit()
                print("✓ Added phases column")
            except Exception as e:
                print(f"✗ Failed to add phases: {e}")
        else:
            print("✓ phases column already exists")
    
    print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    migrate()
