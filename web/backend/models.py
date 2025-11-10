#!/usr/bin/env python3
"""
SQLAlchemy models for TradingAgents Web Interface
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from web.backend.database import Base


class User(Base):
    """
    User model for authentication and user management
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    has_set_password = Column(Boolean, default=False, nullable=False)  # Whether user has explicitly set a password
    role = Column(String(20), default="user", nullable=False, index=True)  # admin, user
    is_active = Column(Boolean, default=True, nullable=False)
    can_access_intraday_trading = Column(Boolean, default=False, nullable=False, index=True)  # Whether user can access intraday trading features
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    analysis_records = relationship("AnalysisRecord", back_populates="user", cascade="all, delete-orphan")
    export_records = relationship("ExportRecord", back_populates="user", cascade="all, delete-orphan")
    scheduled_tasks = relationship("ScheduledTask", back_populates="user", cascade="all, delete-orphan")
    user_config = relationship("UserConfig", back_populates="user", uselist=False, cascade="all, delete-orphan")
    position_records = relationship("PositionRecord", back_populates="user", cascade="all, delete-orphan")
    intraday_decisions = relationship("IntradayDecisionRecord", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"

class UserConfig(Base):
    """
    User configuration model for storing user-specific settings
    Replaces frontend localStorage for better security and cross-device sync
    """
    __tablename__ = "user_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Analysis configuration cache (previously in frontend localStorage)
    last_ticker = Column(String(20), nullable=True)  # Last analyzed stock ticker
    last_analysts = Column(JSON, nullable=True)  # Last selected analysts
    last_research_depth = Column(Integer, nullable=True)  # Last research depth
    last_llm_provider = Column(String(50), nullable=True)  # Last LLM provider
    last_shallow_thinker = Column(String(100), nullable=True)  # Last shallow thinker model
    last_deep_thinker = Column(String(100), nullable=True)  # Last deep thinker model
    last_backend_url = Column(String(255), nullable=True)  # Last backend URL
    
    # Trading executor configuration
    enable_trading_executor = Column(Boolean, default=False, nullable=False)  # Whether to enable trading executor
    futu_api_base_url = Column(String(255), nullable=True)  # Futu API base URL
    futu_api_key = Column(String(255), nullable=True)  # Futu API key (should be encrypted in production)
    
    # Intraday trading configuration
    intraday_futu_api_url = Column(String(255), nullable=True)  # Intraday trading Futu API URL
    intraday_futu_api_key = Column(String(255), nullable=True)  # Intraday trading Futu API key
    intraday_scheduler_enabled = Column(Boolean, default=False, nullable=False)  # Whether intraday scheduler is running
    intraday_scheduler_auto_start = Column(Boolean, default=False, nullable=False)  # Whether to auto-start scheduler on service restart
    intraday_interval_minutes = Column(Integer, default=5, nullable=False)  # Analysis interval in minutes
    intraday_market_type = Column(String(10), default='US', nullable=False)  # Market type: US/HK/CN
    
    # Intraday trading LLM configuration
    intraday_llm_provider = Column(String(50), nullable=True)  # LLM provider for intraday trading
    intraday_api_key = Column(String(255), nullable=True)  # API key for intraday trading LLM
    intraday_llm_model = Column(String(100), nullable=True)  # LLM model for intraday trading (uses deep thinker options)
    intraday_backend_url = Column(String(255), nullable=True)  # Backend URL for intraday trading LLM
    
    # API Key cache (single field for all LLM providers, should be encrypted in production)
    last_api_key = Column(String(255), nullable=True)  # Last used API key (matches last_llm_provider)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="user_config")
    
    def __repr__(self):
        return f"<UserConfig(id={self.id}, user_id={self.user_id})>"

class ScheduledTask(Base):
    """
    Scheduled analysis task model for recurring analysis execution
    """
    __tablename__ = "scheduled_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Task identification
    task_name = Column(String(255), nullable=False)
    
    # Analysis configuration (saved from AnalysisRequest)
    ticker = Column(String(20), nullable=False, index=True)
    market = Column(String(10), nullable=True)
    analysts = Column(JSON, nullable=False)
    research_depth = Column(Integer, nullable=False)
    llm_provider = Column(String(50), nullable=False)
    shallow_thinker = Column(String(100), nullable=False)
    deep_thinker = Column(String(100), nullable=False)
    backend_url = Column(String(255), nullable=False)
    api_key = Column(String(255), nullable=True)  # LLM API key for this scheduled task
    is_public = Column(Boolean, default=False)
    
    # Trading executor configuration
    enable_trading_executor = Column(Boolean, default=False, nullable=False)
    futu_api_base_url = Column(String(255), nullable=True)
    futu_api_key = Column(String(255), nullable=True)
    
    # Email notification settings
    email_notification_enabled = Column(Boolean, default=False, nullable=False)  # Whether to send email notification
    
    # Schedule configuration
    execution_cycle = Column(String(20), nullable=False)  # daily, weekly, every_n_days, workdays
    execution_time = Column(String(5), nullable=False)  # HH:MM format (Beijing time)
    interval_days = Column(Integer, nullable=True)  # For every_n_days cycle
    day_of_week = Column(String(1), nullable=True)  # For weekly cycle (0-6, 0=Sunday)
    end_date = Column(DateTime(timezone=True), nullable=True)  # Optional task end date
    
    # Task status
    is_enabled = Column(Boolean, default=True, nullable=False, index=True)
    status = Column(String(20), default="pending", nullable=False, index=True)  # pending, completed
    
    # Execution tracking
    next_run_time = Column(DateTime(timezone=True), nullable=True)
    last_run_time = Column(DateTime(timezone=True), nullable=True)
    total_executions = Column(Integer, default=0, nullable=False)
    
    # APScheduler job ID
    scheduler_job_id = Column(String(255), unique=True, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="scheduled_tasks")
    
    def __repr__(self):
        return f"<ScheduledTask(id={self.id}, task_name='{self.task_name}', ticker='{self.ticker}', status='{self.status}')>"

class AnalysisRecord(Base):
    """
    Analysis record model to store analysis requests and results
    """
    __tablename__ = "analysis_records"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Analysis parameters
    ticker = Column(String(20), nullable=False, index=True)
    company_name = Column(String(100), nullable=True)  # Company name in Chinese
    market = Column(String(10), nullable=True, index=True)  # US, HK, CN
    analysis_date = Column(String(10), nullable=False)  # YYYY-MM-DD format
    analysts = Column(JSON, nullable=False)  # List of selected analysts
    research_depth = Column(Integer, nullable=False)
    llm_provider = Column(String(50), nullable=False)
    shallow_thinker = Column(String(100), nullable=False)
    deep_thinker = Column(String(100), nullable=False)
    backend_url = Column(String(255), nullable=False)
    api_key = Column(String(255), nullable=True)  # LLM API key for this specific task
    
    # Privacy settings
    is_public = Column(Boolean, default=False, nullable=False, index=True)  # Whether to show in public leaderboard
    
    # Trading executor configuration
    enable_trading_executor = Column(Boolean, default=False, nullable=False)  # Whether to enable trading executor
    futu_api_base_url = Column(String(255), nullable=True)  # Futu API base URL
    futu_api_key = Column(String(255), nullable=True)  # Futu API key
    
    # Email notification settings
    email_notification_enabled = Column(Boolean, default=False, nullable=False)  # Whether to send email notification
    email_sent = Column(Boolean, default=False, nullable=False)  # Whether email was sent
    email_sent_at = Column(DateTime(timezone=True), nullable=True)  # When email was sent
    email_error = Column(Text, nullable=True)  # Email sending error message
    
    # Analysis status and results
    status = Column(String(20), default="queued", nullable=False, index=True)  # queued, running, completed, error
    current_step = Column(String(255), nullable=True)
    progress_percentage = Column(Float, default=0.0, nullable=False)
    
    # Results storage
    final_state = Column(JSON, nullable=True)  # Complete analysis state
    trading_decision = Column(Text, nullable=True)  # Trading decision summary
    final_summary = Column(Text, nullable=True)  # Final comprehensive summary in markdown
    phases = Column(JSON, nullable=True)  # Analysis phases with agent results
    market_analysis = Column(Text, nullable=True)  # Market analysis report
    sentiment_analysis = Column(Text, nullable=True)  # Sentiment analysis report
    news_analysis = Column(Text, nullable=True)  # News analysis report
    fundamentals_analysis = Column(Text, nullable=True)  # Fundamentals analysis report
    risk_assessment = Column(Text, nullable=True)  # Risk assessment report
    
    # Error information
    error_message = Column(Text, nullable=True)
    error_traceback = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="analysis_records")
    logs = relationship("AnalysisLog", back_populates="analysis_record", cascade="all, delete-orphan")
    export_records = relationship("ExportRecord", back_populates="analysis_record", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<AnalysisRecord(id={self.id}, analysis_id='{self.analysis_id}', ticker='{self.ticker}', status='{self.status}')>"

class AnalysisLog(Base):
    """
    Analysis log model to store real-time logs during analysis execution
    """
    __tablename__ = "analysis_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_record_id = Column(Integer, ForeignKey("analysis_records.id"), nullable=False)
    
    # Log details
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    level = Column(String(10), nullable=False, index=True)  # info, warning, error, debug
    message = Column(Text, nullable=False)
    agent = Column(String(100), nullable=True)  # Which agent generated this log
    step = Column(String(255), nullable=True)  # Current step in the analysis
    progress = Column(Float, nullable=True)  # Progress percentage for this step
    
    # Additional metadata
    log_metadata = Column(JSON, nullable=True)  # Additional structured data
    
    # Relationships
    analysis_record = relationship("AnalysisRecord", back_populates="logs")
    
    def __repr__(self):
        return f"<AnalysisLog(id={self.id}, level='{self.level}', agent='{self.agent}', message='{self.message[:50]}...')>"

class ExportRecord(Base):
    """
    Export record model to track PDF and other format exports
    """
    __tablename__ = "export_records"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    analysis_record_id = Column(Integer, ForeignKey("analysis_records.id"), nullable=False)
    
    # Export details
    export_format = Column(String(20), nullable=False)  # pdf, markdown, json
    file_path = Column(String(500), nullable=True)  # Path to generated file
    file_size = Column(Integer, nullable=True)  # File size in bytes
    download_url = Column(String(500), nullable=True)  # Temporary download URL
    
    # Export options
    export_options = Column(JSON, nullable=True)  # Export configuration (format, include_charts, etc.)
    
    # Status and lifecycle
    status = Column(String(20), default="pending", nullable=False)  # pending, processing, completed, error, expired
    expires_at = Column(DateTime(timezone=True), nullable=True)  # When the download link expires
    downloaded_at = Column(DateTime(timezone=True), nullable=True)  # When it was downloaded
    
    # Error information
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="export_records")
    analysis_record = relationship("AnalysisRecord", back_populates="export_records")
    
    def __repr__(self):
        return f"<ExportRecord(id={self.id}, format='{self.export_format}', status='{self.status}')>"


class PositionRecord(Base):
    """
    Position record model to track stock positions for intraday trading
    Records the first opening time and tracks position changes over time
    """
    __tablename__ = "position_records"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stock_code = Column(String(20), nullable=False, index=True)
    market_type = Column(String(10), nullable=False)  # US/HK/CN
    
    # Position info
    first_open_time = Column(DateTime(timezone=True), nullable=False)
    first_open_price = Column(Float, nullable=False)
    initial_quantity = Column(Integer, nullable=False)
    
    # Current status
    current_quantity = Column(Integer, nullable=False)
    last_update_time = Column(DateTime(timezone=True), nullable=False)
    is_closed = Column(Boolean, default=False, nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="position_records")
    trading_history = relationship("TradingHistory", back_populates="position_record", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<PositionRecord(id={self.id}, user_id={self.user_id}, stock_code='{self.stock_code}', market='{self.market_type}')>"


class TradingHistory(Base):
    """
    Trading history model to track all trades for each position
    Records buy/sell actions with decision context
    """
    __tablename__ = "trading_history"
    
    id = Column(Integer, primary_key=True, index=True)
    position_record_id = Column(Integer, ForeignKey("position_records.id"), nullable=False)
    
    # Trade info
    trade_time = Column(DateTime(timezone=True), nullable=False)
    trade_type = Column(String(10), nullable=False)  # BUY/SELL
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    order_id = Column(String(50), nullable=True)
    
    # Decision context
    decision_reason = Column(Text, nullable=True)
    technical_signals = Column(JSON, nullable=True)
    news_sentiment = Column(String(20), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    position_record = relationship("PositionRecord", back_populates="trading_history")
    
    def __repr__(self):
        return f"<TradingHistory(id={self.id}, position_id={self.position_record_id}, type='{self.trade_type}', quantity={self.quantity})>"


class IntradayDecisionRecord(Base):
    """
    Intraday decision record model to store complete analysis sessions
    Records the full decision-making process including tool calls and reasoning
    """
    __tablename__ = "intraday_decision_records"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Session info
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False)  # running/completed/failed
    
    # Analysis context
    market_type = Column(String(10), nullable=False)
    positions_analyzed = Column(JSON, nullable=False)  # List of stock codes
    account_snapshot = Column(JSON, nullable=False)  # Account info at start
    
    # Decision output
    decision_report = Column(Text, nullable=True)
    trades_executed = Column(JSON, nullable=True)  # List of trade details
    tool_calls = Column(JSON, nullable=True)  # Complete tool call sequence
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="intraday_decisions")
    
    def __repr__(self):
        return f"<IntradayDecisionRecord(id={self.id}, session_id='{self.session_id}', status='{self.status}')>"