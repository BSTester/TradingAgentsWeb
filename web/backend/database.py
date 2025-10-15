#!/usr/bin/env python3
"""
Database configuration and session management for TradingAgents Web Interface
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Database URL - use SQLite by default
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tradingagents.db")

# Create engine
if DATABASE_URL.startswith("sqlite"):
    # SQLite specific configuration
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False  # Set to True for SQL debugging
    )
else:
    # PostgreSQL or other databases
    engine = create_engine(DATABASE_URL, echo=False)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()

def get_db():
    """
    Dependency to get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initialize database tables
    """
    # Import all models to ensure they are registered with Base
    from web.backend.models import User, AnalysisRecord, AnalysisLog, ExportRecord
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")

def drop_db():
    """
    Drop all database tables (for development/testing)
    """
    Base.metadata.drop_all(bind=engine)
    print("Database tables dropped successfully")