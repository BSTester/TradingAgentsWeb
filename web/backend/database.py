#!/usr/bin/env python3
"""
Database configuration and session management for TradingAgents Web Interface
Hybrid async/sync implementation for optimal performance
"""

import os
from typing import AsyncGenerator
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

# Database URL - use SQLite by default (db/tradingagents.db in project root)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./db/tradingagents.db")

# Create Base class for models
Base = declarative_base()

# Determine database type and create appropriate engines
if DATABASE_URL.startswith("mysql+aiomysql"):
    # MySQL with async support for API routes
    async_engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=100,
        max_overflow=50,
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_timeout=30,     # Wait up to 30 seconds for a connection
    )
    
    AsyncSessionLocal = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    # Sync engine for background tasks and init_db
    sync_database_url = DATABASE_URL.replace("+aiomysql", "+pymysql")
    sync_engine = create_engine(
        sync_database_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=100,
        max_overflow=50,
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_timeout=30,     # Wait up to 30 seconds for a connection
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)
    
elif DATABASE_URL.startswith("sqlite+aiosqlite"):
    # SQLite with async support
    async_engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )
    
    AsyncSessionLocal = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    # Sync SQLite for background tasks
    sync_database_url = DATABASE_URL.replace("+aiosqlite", "")
    sync_engine = create_engine(
        sync_database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)
    
else:
    # Fallback to sync only
    sync_engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
        poolclass=StaticPool if "sqlite" in DATABASE_URL else None,
        echo=False
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)
    async_engine = None
    AsyncSessionLocal = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Async dependency to get database session (for FastAPI routes)
    """
    if AsyncSessionLocal is None:
        raise RuntimeError("Async database not configured")
    
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def get_sync_db():
    """
    Sync dependency to get database session (for background tasks)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db_sync():
    """
    Initialize database tables (sync operation for scripts)
    """
    # Import all models to ensure they are registered with Base
    from web.backend.models import (
        User, UserConfig, AnalysisRecord, AnalysisLog, ExportRecord, ScheduledTask,
        PositionRecord, TradingHistory, IntradayDecisionRecord
    )
    
    # Create all tables using sync engine
    Base.metadata.create_all(bind=sync_engine)
    
    print("✅ Database tables created successfully")


async def init_db():
    """
    Initialize database tables (async operation for app startup)
    """
    # Import all models to ensure they are registered with Base
    from web.backend.models import (
        User, UserConfig, AnalysisRecord, AnalysisLog, ExportRecord, ScheduledTask,
        PositionRecord, TradingHistory, IntradayDecisionRecord
    )
    
    # Create all tables using async engine
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Database tables created successfully")


async def drop_db():
    """
    Drop all database tables (for development/testing)
    """
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    print("✅ Database tables dropped successfully")