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
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    analysis_records = relationship("AnalysisRecord", back_populates="user", cascade="all, delete-orphan")
    export_records = relationship("ExportRecord", back_populates="user", cascade="all, delete-orphan")
    scheduled_tasks = relationship("ScheduledTask", back_populates="user", cascade="all, delete-orphan")
    user_config = relationship("UserConfig", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
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
    
    # API Key cache (single field for all LLM providers, should be encrypted in production)
    last_api_key = Column(String(1000), nullable=True)  # Last used API key (supports JWT tokens)
    
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
    api_key = Column(String(1000), nullable=True)  # LLM API key for this scheduled task (supports JWT tokens)
    is_public = Column(Boolean, default=False)
    
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
    api_key = Column(String(1000), nullable=True)  # LLM API key for this specific task (supports JWT tokens)
    
    # Privacy settings
    is_public = Column(Boolean, default=False, nullable=False, index=True)  # Whether report can be viewed without login
    
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


class AgentTool(Base):
    """
    Agent tool definition model (system-maintained)
    Stores metadata about available tools that agents can use
    """
    __tablename__ = "agent_tools"
    
    id = Column(Integer, primary_key=True, index=True)
    tool_name = Column(String(100), unique=True, nullable=False, index=True)
    tool_description = Column(Text, nullable=False)
    tool_parameters = Column(JSON, nullable=False)  # JSON schema of parameters
    category = Column(String(50), nullable=True, index=True)  # account, market_data, trading, news
    is_available = Column(Boolean, default=True, nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def to_dict(self):
        return {
            "id": self.id,
            "tool_name": self.tool_name,
            "tool_description": self.tool_description,
            "tool_parameters": self.tool_parameters,
            "category": self.category,
            "is_available": self.is_available,
        }
    
    def __repr__(self):
        return f"<AgentTool(id={self.id}, name='{self.tool_name}', category='{self.category}')>"


class AgentPromptTemplate(Base):
    """
    Agent prompt template model (user-editable)
    Stores user-customized system prompts for different agent types
    """
    __tablename__ = "agent_prompt_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_type = Column(String(50), nullable=False, index=True)  # analysis_agent, analyst, etc.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # User-editable prompt
    system_prompt = Column(Text, nullable=False)
    
    # Metadata
    template_name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    version = Column(String(50), default="1.0", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User")
    template_tools = relationship("TemplateTools", back_populates="template", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "agent_type": self.agent_type,
            "user_id": self.user_id,
            "system_prompt": self.system_prompt,
            "template_name": self.template_name,
            "description": self.description,
            "version": self.version,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self):
        return f"<AgentPromptTemplate(id={self.id}, agent_type='{self.agent_type}', user_id={self.user_id})>"


class TemplateTools(Base):
    """
    Template-tool association model
    Tracks which tools are enabled for each prompt template
    """
    __tablename__ = "template_tools"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("agent_prompt_templates.id"), nullable=False, index=True)
    tool_name = Column(String(100), ForeignKey("agent_tools.tool_name"), nullable=False, index=True)
    is_enabled = Column(Boolean, default=True, nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    template = relationship("AgentPromptTemplate", back_populates="template_tools")
    
    def __repr__(self):
        return f"<TemplateTools(id={self.id}, template_id={self.template_id}, tool='{self.tool_name}', enabled={self.is_enabled})>"


class LLMProvider(Base):
    """
    LLM Provider model for managing LLM service providers
    管理LLM服务供应商
    """
    __tablename__ = "llm_providers"
    
    id = Column(Integer, primary_key=True, index=True)
    provider_name = Column(String(100), unique=True, nullable=False, index=True)  # 供应商名称（唯一标识）
    display_name = Column(String(200), nullable=False)  # 显示名称
    api_key = Column(String(1000), nullable=True)  # API密钥（加密存储）- 支持JWT token
    base_url = Column(String(500), nullable=True)  # API基础URL
    description = Column(Text, nullable=True)  # 供应商描述
    is_active = Column(Boolean, default=True, nullable=False, index=True)  # 是否启用
    config_json = Column(JSON, nullable=True)  # 额外配置参数（JSON格式）
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    models = relationship("LLMModel", back_populates="provider", cascade="all, delete-orphan")
    
    def to_dict(self, include_api_key=False):
        """Convert to dictionary, optionally masking API key"""
        # 获取实际值而不是Column对象
        api_key_value = self.api_key
        
        # 根据include_api_key参数决定是否返回完整密钥
        if include_api_key:
            # 返回完整API密钥（用于编辑时显示）
            masked_api_key = api_key_value if api_key_value else None
        else:
            # 返回脱敏的API密钥（用于列表显示）
            if api_key_value and len(str(api_key_value)) > 4:
                masked_api_key = "***" + str(api_key_value)[-4:]
            else:
                masked_api_key = None
        
        return {
            "id": self.id,
            "provider_name": self.provider_name,
            "display_name": self.display_name,
            "api_key": masked_api_key,
            "base_url": self.base_url,
            "description": self.description,
            "is_active": self.is_active,
            "config_json": self.config_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self):
        return f"<LLMProvider(id={self.id}, name='{self.provider_name}', display='{self.display_name}', active={self.is_active})>"


class LLMModel(Base):
    """
    LLM Model model for managing specific models under providers
    管理供应商下的具体模�?    """
    __tablename__ = "llm_models"
    
    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("llm_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    model_name = Column(String(200), nullable=False, index=True)  # 模型名称
    model_type = Column(String(50), nullable=False, index=True)  # 模型类型：shallow_thinker/deep_thinker
    display_name = Column(String(200), nullable=False)  # 显示名称
    description = Column(Text, nullable=True)  # 模型描述
    is_active = Column(Boolean, default=True, nullable=False, index=True)  # 是否启用
    config_json = Column(JSON, nullable=True)  # 模型配置参数（JSON格式�?    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    provider = relationship("LLMProvider", back_populates="models")
    
    def to_dict(self):
        return {
            "id": self.id,
            "provider_id": self.provider_id,
            "model_name": self.model_name,
            "model_type": self.model_type,
            "display_name": self.display_name,
            "description": self.description,
            "is_active": self.is_active,
            "config_json": self.config_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self):
        return f"<LLMModel(id={self.id}, name='{self.model_name}', type='{self.model_type}', provider_id={self.provider_id}, active={self.is_active})>"
