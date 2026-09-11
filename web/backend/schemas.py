#!/usr/bin/env python3
"""
Pydantic schemas for TradingAgents Web Interface
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse
from pydantic import BaseModel, EmailStr, Field, validator

# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: Optional[str] = None  # Password is now optional
    # Cloudflare Turnstile 人机验证 token（前端 widget 回传）
    turnstile_token: Optional[str] = None
    # 邮箱验证码
    email_code: Optional[str] = None
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Username must be between 3 and 50 characters')
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username can only contain letters, numbers, underscores, and hyphens')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        if v and len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v
    
    @validator('email_code')
    def validate_email_code(cls, v):
        if v and (not v.isdigit() or len(v) != 6):
            raise ValueError('Email verification code must be exactly 6 digits')
        return v

class PasswordSetRequest(BaseModel):
    """Request schema for setting password"""
    password: str
    old_password: Optional[str] = None  # Required when updating existing password
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v

class UserLogin(BaseModel):
    username: str
    password: str
    # Cloudflare Turnstile 人机验证 token（前端 widget 回传）
    turnstile_token: Optional[str] = None

class User(UserBase):
    id: int
    role: str
    is_active: bool
    has_set_password: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserInDB(User):
    hashed_password: str

# Captcha（已废弃：图形验证码已替换为 Cloudflare Turnstile，保留仅为向后兼容引用）
class CaptchaResponse(BaseModel):
    captcha_id: str
    seed: str

# Email verification code schemas
class EmailCodeSendRequest(BaseModel):
    """Request schema for sending verification code"""
    email: EmailStr
    turnstile_token: Optional[str] = None

class EmailCodeSendResponse(BaseModel):
    """Response schema for send verification code"""
    message: str
    expires_in: int  # seconds

class EmailCodeLoginRequest(BaseModel):
    """Request schema for email code login"""
    email: EmailStr
    code: str
    turnstile_token: Optional[str] = None
    
    @validator('code')
    def validate_code(cls, v):
        if not v.isdigit() or len(v) != 6:
            raise ValueError('Verification code must be exactly 6 digits')
        return v

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
    llm_provider: str = "openai"
    backend_url: str = "https://api.openai.com/v1"
    shallow_thinker: str = "gpt-5.5"
    deep_thinker: str = "gpt-5.5"
    # Privacy settings
    is_public: bool = False  # Whether to make the generated report public
    # API Key (single field for all LLM providers)
    api_key: Optional[str] = None  # API key for the selected LLM provider
    # Email notification settings
    email_notification: bool = False  # Whether to send email notification when analysis completes
    
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
    email_notification_enabled: bool = False

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
    email_notification_enabled: bool = False
    email_sent: bool = False
    email_sent_at: Optional[datetime] = None
    
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
    email_notification_enabled: bool = False
    email_sent: bool = False
    email_sent_at: Optional[datetime] = None
    email_error: Optional[str] = None
    
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
    turnstile_site_key: Optional[str] = None
    turnstile_enabled: bool = False

# API Key validation
# Pagination
class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool

# Scheduled Task schemas
# User Status Update schemas
class UserStatusUpdate(BaseModel):
    """Schema for updating user status"""
    is_active: bool

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
    
    class Config:
        from_attributes = True


# ============================================================================
# Prompt Template Management Schemas
# ============================================================================

class PromptTemplateBase(BaseModel):
    template_name: Optional[str] = Field(None, max_length=200, description="策略标题，最多200个字符")
    description: Optional[str] = Field(None, max_length=500, description="策略描述，最多500个字符")
    system_prompt: str = Field(..., max_length=20000, description="系统提示词，最多20000个字符")
    version: Optional[str] = Field("1.0", max_length=50)


class PromptTemplateCreate(PromptTemplateBase):
    agent_type: str = "analysis_agent"


class PromptTemplateUpdate(BaseModel):
    template_name: Optional[str] = Field(None, max_length=200, description="策略标题，最多200个字符")
    description: Optional[str] = Field(None, max_length=500, description="策略描述，最多500个字符")
    system_prompt: Optional[str] = Field(None, max_length=20000, description="系统提示词，最多20000个字符")
    version: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class PromptTemplateResponse(BaseModel):
    id: int
    agent_type: str
    user_id: int
    system_prompt: str
    template_name: Optional[str]
    description: Optional[str]
    version: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    enabled_tools: List[str] = []
    
    class Config:
        from_attributes = True


class ToolResponse(BaseModel):
    id: int
    tool_name: str
    tool_description: str
    tool_parameters: Dict[str, Any]
    category: Optional[str]
    is_available: bool
    
    class Config:
        from_attributes = True


class ToolSelectionUpdate(BaseModel):
    tool_name: str
    is_enabled: bool


class BulkToolSelectionUpdate(BaseModel):
    tools: List[ToolSelectionUpdate]


# ============================================================================
# LLM Provider and Model Management Schemas
# ============================================================================

# ---------------------------------------------------------------------------
# 订阅/积分与后台管理契约（report_routes / subscription_routes / admin_routes 依赖）
# 合并远端主干时上游 schemas 未包含这些模型，在此补齐以保证路由可导入。
# ---------------------------------------------------------------------------

class ReportPublicIn(BaseModel):
    is_public: bool


class UserRoleUpdateIn(BaseModel):
    role: str = Field(..., pattern="^(user|admin)$")
