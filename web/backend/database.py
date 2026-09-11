#!/usr/bin/env python3
"""
Database configuration and session management for TradingAgents Web Interface
Hybrid async/sync implementation for optimal performance
"""

import os
from typing import AsyncGenerator
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool, QueuePool

# Database URL - use SQLite by default (db/tradingagents.db in project root)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./db/tradingagents.db")

# Create Base class for models
Base = declarative_base()


def _enable_sqlite_pragmas(engine, busy_timeout_ms: int = 30000) -> None:
    """为同步 SQLite 引擎设置 WAL / busy_timeout / synchronous=NORMAL。

    - WAL（Write-Ahead Logging）允许读写并发，显著降低 50 线程任务池
      与 API 请求并发写库时的 `database is locked` 概率（WAL 持久化到库文件）。
    - busy_timeout：写锁冲突时等待而非直接报错。
    - synchronous=NORMAL：WAL 模式下的推荐设置，兼顾安全与写入性能。
    """
    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute(f"PRAGMA busy_timeout={busy_timeout_ms}")
            cursor.execute("PRAGMA synchronous=NORMAL")
        finally:
            cursor.close()


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
    # timeout=30：aiosqlite/sqlite3 的 busy timeout（秒），写锁冲突时等待而非报错
    async_engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    
    AsyncSessionLocal = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    # Sync SQLite for background tasks.
    # 注意：此前使用 StaticPool（全进程共享单条连接），50 个任务线程
    # 并发使用同一条 sqlite3 连接存在竞态风险；改为 QueuePool 让每个线程
    # 持有独立连接，配合 WAL + busy_timeout 实现安全的并发读写。
    sync_database_url = DATABASE_URL.replace("+aiosqlite", "")
    sync_engine = create_engine(
        sync_database_url,
        connect_args={"check_same_thread": False, "timeout": 30},
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_timeout=30,
        echo=False,
    )
    _enable_sqlite_pragmas(sync_engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)
    
else:
    # Fallback to sync only
    sync_engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30} if "sqlite" in DATABASE_URL else {},
        poolclass=QueuePool if "sqlite" in DATABASE_URL else None,
        echo=False
    )
    if "sqlite" in DATABASE_URL:
        _enable_sqlite_pragmas(sync_engine)
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
        ConversationSession, ConversationMessage, UserLLMProviderSetting,
        AgentTool, AgentPromptTemplate, TemplateTools, LLMProvider, LLMModel
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
        ConversationSession, ConversationMessage, UserLLMProviderSetting,
        AgentTool, AgentPromptTemplate, TemplateTools, LLMProvider, LLMModel
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
