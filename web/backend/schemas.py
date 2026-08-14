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
    llm_providers: List[Dict[str, Any]]
    models: Dict[str, Dict[str, List[Dict[str, str]]]]
    system_default: Optional[Dict[str, Any]] = None

# API Key validation
class APIKeyValidation(BaseModel):
    provider: str
    api_key: str

class APIKeyValidationResponse(BaseModel):
    valid: bool
    message: str


class LegacyLLMConfigSummary(BaseModel):
    available: bool
    last_llm_provider: Optional[str] = None
    last_backend_url: Optional[str] = None


class UserLLMProviderBase(BaseModel):
    provider_name: str = Field(..., min_length=1, max_length=100)
    provider_type: str = Field(..., description="catalog or custom")
    catalog_provider_id: Optional[int] = Field(None, ge=1)
    display_name: str = Field(..., min_length=1, max_length=200)
    base_url: str = Field(..., min_length=1, max_length=500)
    shallow_model: str = Field(..., min_length=1, max_length=200)
    deep_model: str = Field(..., min_length=1, max_length=200)
    is_enabled: bool = True
    is_default: bool = False

    class Config:
        extra = "forbid"

    @validator("provider_name")
    def validate_user_provider_name(cls, v):
        import re
        value = v.strip().lower()
        if not re.match(r"^[a-zA-Z0-9_-]+$", value):
            raise ValueError("Provider name can only contain letters, numbers, underscores, and hyphens")
        return value

    @validator("provider_type")
    def validate_user_provider_type(cls, v):
        value = v.strip().lower()
        if value not in {"catalog", "custom"}:
            raise ValueError("provider_type must be catalog or custom")
        return value

    @validator("base_url")
    def validate_user_provider_base_url(cls, v):
        value = v.strip()
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("base_url must be an absolute HTTP(S) URL")
        return value


class UserLLMProviderCreate(UserLLMProviderBase):
    pass


class UserLLMProviderUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    base_url: Optional[str] = Field(None, min_length=1, max_length=500)
    shallow_model: Optional[str] = Field(None, min_length=1, max_length=200)
    deep_model: Optional[str] = Field(None, min_length=1, max_length=200)
    is_enabled: Optional[bool] = None
    is_default: Optional[bool] = None

    class Config:
        extra = "forbid"

    @validator("base_url")
    def validate_update_base_url(cls, v):
        if v is None:
            return v
        value = v.strip()
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("base_url must be an absolute HTTP(S) URL")
        return value


class UserLLMProviderResponse(BaseModel):
    id: int
    provider_name: str
    provider_type: str
    catalog_provider_id: Optional[int] = None
    display_name: str
    base_url: str
    shallow_model: str
    deep_model: str
    is_enabled: bool
    is_default: bool
    last_validated_at: Optional[datetime] = None
    last_validation_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserLLMSettingsResponse(BaseModel):
    providers: List[UserLLMProviderResponse]
    default_provider_id: Optional[int]
    has_legacy_config: bool
    legacy_config: Optional[LegacyLLMConfigSummary] = None


class UserLLMConnectionTestRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=1000)
    base_url: Optional[str] = Field(None, min_length=1, max_length=500)
    model: Optional[str] = Field(None, min_length=1, max_length=200)

    class Config:
        extra = "forbid"

    @validator("base_url")
    def validate_test_base_url(cls, v):
        if v is None:
            return v
        value = v.strip()
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("base_url must be an absolute HTTP(S) URL")
        return value


class UserLLMConnectionTestResponse(BaseModel):
    valid: bool
    message: str
    last_validated_at: datetime
    last_validation_status: str
    details: Optional[Dict[str, Any]] = None

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
    
    # Email notification settings
    email_notification: bool = False  # Whether to send email notification when task completes
    
    # API Key (single field for all LLM providers)
    api_key: Optional[str] = None  # API key for the selected LLM provider
    
    # Schedule configuration (optional for immediate execution)
    execution_cycle: Optional[str] = None  # daily, weekly, monthly, interval, every_n_days, workdays
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
        if v and v not in ['daily', 'weekly', 'monthly', 'interval', 'every_n_days', 'workdays']:
            raise ValueError('Invalid execution cycle. Must be one of: daily, weekly, monthly, interval, every_n_days, workdays')
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
        if values.get('execution_cycle') in ('every_n_days', 'interval'):
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
    email_notification_enabled: bool
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
    task_name: Optional[str] = None
    ticker: Optional[str] = None
    is_enabled: Optional[bool] = None
    execution_cycle: Optional[str] = None
    execution_time: Optional[str] = None
    interval_days: Optional[int] = None
    end_date: Optional[str] = None
    
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

class LLMProviderBase(BaseModel):
    provider_name: str = Field(..., max_length=100, description="供应商唯一标识")
    display_name: str = Field(..., max_length=200, description="显示名称")
    api_key: Optional[str] = Field(None, max_length=1000, description="API密钥 - 支持长密钥如JWT")
    base_url: Optional[str] = Field(None, max_length=500, description="API基础URL")
    description: Optional[str] = Field(None, description="供应商描述")
    is_active: bool = Field(True, description="是否启用")
    config_json: Optional[Dict[str, Any]] = Field(None, description="额外配置参数")
    
    @validator('provider_name')
    def validate_provider_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Provider name cannot be empty')
        # Only allow alphanumeric, underscore, and hyphen
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Provider name can only contain letters, numbers, underscores, and hyphens')
        return v.strip().lower()


class LLMProviderCreate(LLMProviderBase):
    pass


class LLMProviderUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=200)
    api_key: Optional[str] = Field(None, max_length=1000)
    base_url: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    config_json: Optional[Dict[str, Any]] = None


class LLMProviderResponse(BaseModel):
    model_config = {"from_attributes": True}
    
    id: int
    provider_name: str
    display_name: str
    api_key: Optional[str]  # Will be masked in response
    base_url: Optional[str]
    description: Optional[str]
    is_active: bool
    is_default: bool = False
    config_json: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    models_count: Optional[int] = 0  # Number of models under this provider


class SetSystemDefaultProviderRequest(BaseModel):
    provider_id: int = Field(..., ge=1, description="Provider ID to use as system fallback")


class SystemDefaultProviderResponse(BaseModel):
    provider_id: int
    provider_name: str
    display_name: str
    base_url: Optional[str]
    is_active: bool
    credential_configured: bool
    has_api_key: bool
    api_key_masked: Optional[str] = None
    shallow_model: Optional[str] = None
    deep_model: Optional[str] = None
    updated_at: Optional[datetime] = None


class PublicSystemDefaultProviderResponse(BaseModel):
    provider_id: int
    provider_name: str
    display_name: str
    base_url: Optional[str]
    has_api_key: bool
    api_key_masked: Optional[str] = None
    shallow_model: Optional[str] = None
    deep_model: Optional[str] = None


class LLMModelBase(BaseModel):
    model_config = {"protected_namespaces": ()}  # Disable model_ namespace protection
    
    model_name: str = Field(..., max_length=200, description="模型名称")
    model_type: str = Field(..., max_length=50, description="模型类型：shallow_thinker/deep_thinker")
    display_name: str = Field(..., max_length=200, description="显示名称")
    description: Optional[str] = Field(None, description="模型描述")
    is_active: bool = Field(True, description="是否启用")
    config_json: Optional[Dict[str, Any]] = Field(None, description="模型配置参数")
    
    @validator('model_type')
    def validate_model_type(cls, v):
        if v not in ['shallow_thinker', 'deep_thinker']:
            raise ValueError('Model type must be either shallow_thinker or deep_thinker')
        return v


class LLMModelCreate(LLMModelBase):
    provider_id: int = Field(..., description="所属供应商ID")


class LLMModelUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}  # Disable model_ namespace protection
    
    model_name: Optional[str] = Field(None, max_length=200)
    model_type: Optional[str] = Field(None, max_length=50)
    display_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    config_json: Optional[Dict[str, Any]] = None
    
    @validator('model_type')
    def validate_model_type(cls, v):
        if v is not None and v not in ['shallow_thinker', 'deep_thinker']:
            raise ValueError('Model type must be either shallow_thinker or deep_thinker')
        return v


class LLMModelResponse(BaseModel):
    model_config = {
        "protected_namespaces": (),  # Disable model_ namespace protection
        "from_attributes": True
    }
    
    id: int
    provider_id: int
    model_name: str
    model_type: str
    display_name: str
    description: Optional[str]
    is_active: bool
    config_json: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    provider_name: Optional[str] = None  # Include provider name for convenience
    provider_display_name: Optional[str] = None


class LLMConnectionTest(BaseModel):
    """Schema for testing LLM provider connection"""
    model_config = {"protected_namespaces": ()}  # Disable model_ namespace protection
    
    provider_id: Optional[int] = None
    provider_name: Optional[str] = None
    api_key: str
    base_url: str
    model_name: Optional[str] = None  # Optional: test with specific model


class LLMConnectionTestResponse(BaseModel):
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None
