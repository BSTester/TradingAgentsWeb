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

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserInDB(User):
    hashed_password: str

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
    # API Keys
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    
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