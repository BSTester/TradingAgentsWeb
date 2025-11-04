#!/usr/bin/env python3
"""
Pydantic schemas for TradingAgents Web Interface
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, validator

# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    # 服务端验证码（防绕过前端）
    captcha_id: Optional[str] = None
    captcha_answer: Optional[str] = None
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Username must be between 3 and 50 characters')
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username can only contain letters, numbers, underscores, and hyphens')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v

class UserLogin(BaseModel):
    username: str
    password: str
    # 服务端验证码（防绕过前端）
    captcha_id: Optional[str] = None
    captcha_answer: Optional[str] = None

class User(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserInDB(User):
    hashed_password: str

# Captcha
class CaptchaResponse(BaseModel):
    captcha_id: str
    seed: str

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Authentication response
class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: User

# Analysis schemas
class AnalysisRequest(BaseModel):
    ticker: str
    analysis_date: str
    analysts: List[str]
    research_depth: int
    llm_provider: str
    backend_url: str
    shallow_thinker: str
    deep_thinker: str
    # Privacy settings
    is_public: bool = False  # Whether to show in public leaderboard
    # Trading executor settings
    enable_trading_executor: bool = False  # Whether to enable trading executor
    futu_api_base_url: Optional[str] = None  # Futu API base URL
    futu_api_key: Optional[str] = None  # Futu API key
    # API Key (single field for all LLM providers)
    api_key: Optional[str] = None  # API key for the selected LLM provider
    
    @validator('analysis_date')
    def validate_date(cls, v):
        try:
            from datetime import datetime, date
            analysis_date = datetime.strptime(v, '%Y-%m-%d')
            if analysis_date.date() > date.today():
                raise ValueError('Analysis date cannot be in the future')
            return v
        except ValueError as e:
            if 'Analysis date cannot be in the future' in str(e):
                raise e
            raise ValueError('Invalid date format. Use YYYY-MM-DD')
    
    @validator('analysts')
    def validate_analysts(cls, v):
        if not v:
            raise ValueError('At least one analyst must be selected')
        return v

class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    message: Optional[str] = None

class AnalysisStatus(BaseModel):
    analysis_id: str
    status: str
    current_step: Optional[str] = None
    progress_percentage: float = 0.0
    started_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Configuration info for UI initialization
    selected_analysts: Optional[List[str]] = None
    enable_trading_executor: bool = False

class AnalysisRecord(BaseModel):
    id: int
    analysis_id: str
    ticker: str
    analysis_date: str
    status: str
    progress_percentage: float
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class AnalysisResults(BaseModel):
    analysis_id: str
    ticker: str
    analysis_date: str
    status: str
    trading_decision: Optional[str] = None
    market_analysis: Optional[str] = None
    sentiment_analysis: Optional[str] = None
    news_analysis: Optional[str] = None
    fundamentals_analysis: Optional[str] = None
    risk_assessment: Optional[str] = None
    final_state: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Log schemas
class LogEntry(BaseModel):
    timestamp: datetime
    level: str
    message: str
    agent: Optional[str] = None
    step: Optional[str] = None
    progress: Optional[float] = None
    
    class Config:
        from_attributes = True

# Export schemas
class ExportRequest(BaseModel):
    format: str = "pdf"  # pdf, markdown, json
    include_charts: bool = True
    include_raw_data: bool = False
    
    @validator('format')
    def validate_format(cls, v):
        if v not in ['pdf', 'markdown', 'json']:
            raise ValueError('Format must be pdf, markdown, or json')
        return v

class ExportResponse(BaseModel):
    export_id: int
    download_url: str
    expires_at: datetime
    file_size: Optional[int] = None

class ExportRecord(BaseModel):
    id: int
    export_format: str
    status: str
    file_size: Optional[int] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Configuration schemas
class ConfigResponse(BaseModel):
    analysts: List[Dict[str, str]]
    research_depths: List[Dict[str, Any]]
    llm_providers: List[Dict[str, Any]]
    models: Dict[str, Dict[str, List[Dict[str, str]]]]

# API Key validation
class APIKeyValidation(BaseModel):
    provider: str
    api_key: str

class APIKeyValidationResponse(BaseModel):
    valid: bool
    message: str

# Pagination
class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool

# Scheduled Task schemas
class ScheduledTaskCreate(BaseModel):
    """Schema for creating a scheduled task"""
    task_name: str
    ticker: str
    analysts: List[str]
    research_depth: int
    llm_provider: str
    backend_url: str
    shallow_thinker: str
    deep_thinker: str
    is_public: bool = False
    
    # Trading executor configuration
    enable_trading_executor: bool = False
    futu_api_base_url: Optional[str] = None
    futu_api_key: Optional[str] = None
    
    # Schedule configuration (optional for immediate execution)
    execution_cycle: Optional[str] = None  # daily, weekly, every_n_days, workdays
    execution_time: Optional[str] = None  # HH:MM format (Beijing time)
    interval_days: Optional[int] = None  # Required if execution_cycle is every_n_days
    day_of_week: Optional[str] = None  # Required if execution_cycle is weekly (0-6, 0=Sunday)
    end_date: Optional[str] = None  # Optional end date in YYYY-MM-DD format
    
    @validator('task_name')
    def validate_task_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Task name cannot be empty')
        if len(v) > 255:
            raise ValueError('Task name must be less than 255 characters')
        return v.strip()
    
    @validator('execution_cycle')
    def validate_execution_cycle(cls, v):
        if v and v not in ['daily', 'weekly', 'every_n_days', 'workdays']:
            raise ValueError('Invalid execution cycle. Must be one of: daily, weekly, every_n_days, workdays')
        return v
    
    @validator('execution_time')
    def validate_execution_time(cls, v):
        if v:
            import re
            if not re.match(r'^([01]\d|2[0-3]):([0-5]\d)$', v):
                raise ValueError('Invalid time format. Use HH:MM (24-hour format)')
        return v
    
    @validator('interval_days')
    def validate_interval_days(cls, v, values):
        if values.get('execution_cycle') == 'every_n_days':
            if not v or v < 1 or v > 365:
                raise ValueError('interval_days must be between 1 and 365 when execution_cycle is every_n_days')
        return v
    
    @validator('day_of_week')
    def validate_day_of_week(cls, v, values):
        if values.get('execution_cycle') == 'weekly':
            if not v or v not in ['0', '1', '2', '3', '4', '5', '6']:
                raise ValueError('day_of_week must be specified for weekly cycle (0-6, 0=Sunday)')
        return v
    
    @validator('end_date')
    def validate_end_date(cls, v):
        if v:
            from datetime import datetime, date
            try:
                end_date = datetime.strptime(v, '%Y-%m-%d').date()
                if end_date < date.today():
                    raise ValueError('End date cannot be in the past')
            except ValueError as e:
                if 'End date cannot be in the past' in str(e):
                    raise
                raise ValueError('Invalid date format. Use YYYY-MM-DD')
        return v
    
    @validator('analysts')
    def validate_analysts(cls, v):
        if not v:
            raise ValueError('At least one analyst must be selected')
        return v

class ScheduledTaskResponse(BaseModel):
    """Schema for scheduled task response"""
    id: int
    user_id: int
    task_name: str
    ticker: str
    market: Optional[str]
    analysts: List[str]
    research_depth: int
    llm_provider: str
    shallow_thinker: str
    deep_thinker: str
    backend_url: str
    is_public: bool
    enable_trading_executor: bool
    futu_api_base_url: Optional[str]
    futu_api_key: Optional[str]
    execution_cycle: str
    execution_time: str
    interval_days: Optional[int]
    day_of_week: Optional[str]
    end_date: Optional[datetime]
    is_enabled: bool
    status: str
    next_run_time: Optional[datetime]
    last_run_time: Optional[datetime]
    total_executions: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class ScheduledTaskUpdate(BaseModel):
    """Schema for updating task status"""
    is_enabled: Optional[bool] = None
    task_name: Optional[str] = None
    
    @validator('task_name')
    def validate_task_name(cls, v):
        if v is not None:
            if len(v.strip()) == 0:
                raise ValueError('Task name cannot be empty')
            if len(v) > 255:
                raise ValueError('Task name must be less than 255 characters')
            return v.strip()
        return v

class ScheduledTaskListResponse(BaseModel):
    """Schema for paginated scheduled task list"""
    items: List[ScheduledTaskResponse]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool
    # Statistics for all tasks (not just current page)
    stats: Optional[dict] = None  # {"enabled": int, "paused": int, "completed": int}

# User Configuration schemas
class UserConfigUpdate(BaseModel):
    """Schema for updating user configuration - all analysis settings"""
    # Analysis configuration cache (previously stored in frontend localStorage)
    last_ticker: Optional[str] = None  # 最后分析的股票代码
    last_analysts: Optional[List[str]] = None
    last_research_depth: Optional[int] = None
    last_llm_provider: Optional[str] = None
    last_shallow_thinker: Optional[str] = None
    last_deep_thinker: Optional[str] = None
    last_backend_url: Optional[str] = None
    
    # Trading executor configuration
    enable_trading_executor: Optional[bool] = None
    futu_api_base_url: Optional[str] = None
    futu_api_key: Optional[str] = None
    
    # API Key (single field for all LLM providers)
    last_api_key: Optional[str] = None  # Last used API key (matches last_llm_provider)

class UserConfigResponse(BaseModel):
    """Schema for user configuration response - returns all cached settings"""
    # Analysis configuration cache
    last_ticker: Optional[str] = None  # 最后分析的股票代码
    last_analysts: Optional[List[str]] = None
    last_research_depth: Optional[int] = None
    last_llm_provider: Optional[str] = None
    last_shallow_thinker: Optional[str] = None
    last_deep_thinker: Optional[str] = None
    last_backend_url: Optional[str] = None
    
    # Trading executor configuration
    enable_trading_executor: bool = False
    futu_api_base_url: Optional[str] = None
    futu_api_key: Optional[str] = None
    
    # API Key (returns actual key for frontend to use)
    last_api_key: Optional[str] = None  # Last used API key (matches last_llm_provider)
    
    class Config:
        from_attributes = True