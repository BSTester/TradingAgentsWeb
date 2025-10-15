#!/usr/bin/env python3
"""
Database initialization script for TradingAgents Web Interface
"""

import sys
import os
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import init_db, drop_db, engine
from web.backend.models import User, AnalysisRecord, AnalysisLog, ExportRecord
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
import argparse

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_sample_user():
    """
    Create a sample user for testing
    """
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == "admin").first()
        if existing_user:
            print("Sample user 'admin' already exists")
            return
        
        # Create sample user
        hashed_password = pwd_context.hash("admin123")
        sample_user = User(
            username="admin",
            email="admin@tradingagents.com",
            hashed_password=hashed_password,
            is_active=True
        )
        
        db.add(sample_user)
        db.commit()
        print("Sample user created:")
        print("  Username: admin")
        print("  Password: admin123")
        print("  Email: admin@tradingagents.com")
        
    except Exception as e:
        print(f"Error creating sample user: {e}")
        db.rollback()
    finally:
        db.close()

def main():
    """
    Main function to handle database initialization
    """
    parser = argparse.ArgumentParser(description="Initialize TradingAgents database")
    parser.add_argument("--drop", action="store_true", help="Drop existing tables before creating new ones")
    parser.add_argument("--sample-user", action="store_true", help="Create a sample user for testing")
    
    args = parser.parse_args()
    
    try:
        if args.drop:
            print("Dropping existing database tables...")
            drop_db()
        
        print("Initializing database tables...")
        init_db()
        
        if args.sample_user:
            print("Creating sample user...")
            create_sample_user()
        
        print("Database initialization completed successfully!")
        
    except Exception as e:
        print(f"Error during database initialization: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()