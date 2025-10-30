#!/usr/bin/env python3
"""
Authentication routes for TradingAgents Web Interface
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from web.backend.database import get_db
from web.backend.schemas import UserCreate, UserLogin, AuthResponse, User as UserSchema, Token, CaptchaResponse
from web.backend.auth import (
    authenticate_user, 
    create_user, 
    create_access_token, 
    get_current_user_from_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from web.backend.models import User

# Create router
router = APIRouter(prefix="/api/auth", tags=["authentication"])

# 简单内存级限流与失败计数（生产可替换为Redis等）
from collections import defaultdict, deque
from typing import Deque, Dict
import time

_CAPTCHA_REQUESTS: Dict[str, Deque[float]] = defaultdict(deque)  # 每IP的验证码请求时间戳
_FAILED_ATTEMPTS: Dict[str, Deque[float]] = defaultdict(deque)   # 每IP的失败时间戳

CAPTCHA_RATE_LIMIT = 20          # 每分钟最多获取20次验证码/每IP
CAPTCHA_RATE_WINDOW = 60         # 秒
FAIL_WINDOW = 600                # 10分钟
FAIL_LIMIT = 5                   # 10分钟内最多失败5次

def _prune(dq: Deque[float], window: int):
    now = time.time()
    while dq and now - dq[0] > window:
        dq.popleft()

def _check_rate(ip: str) -> bool:
    dq = _CAPTCHA_REQUESTS[ip]
    _prune(dq, CAPTCHA_RATE_WINDOW)
    return len(dq) < CAPTCHA_RATE_LIMIT

def _note_captcha_request(ip: str):
    dq = _CAPTCHA_REQUESTS[ip]
    _prune(dq, CAPTCHA_RATE_WINDOW)
    dq.append(time.time())

def _note_fail(ip: str):
    dq = _FAILED_ATTEMPTS[ip]
    _prune(dq, FAIL_WINDOW)
    dq.append(time.time())

def _too_many_fails(ip: str) -> bool:
    dq = _FAILED_ATTEMPTS[ip]
    _prune(dq, FAIL_WINDOW)
    return len(dq) >= FAIL_LIMIT

@router.post("/captcha/new", response_model=CaptchaResponse)
async def new_captcha(request: Request):
    """
    Create new captcha challenge and return seed and id (frontend draws image via Canvas using seed)
    """
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate(client_ip):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="验证码请求过于频繁，请稍后再试")
    try:
        from web.backend.captcha import create_captcha
        cid, seed = create_captcha()
        _note_captcha_request(client_ip)
        return {"captcha_id": cid, "seed": seed}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"生成验证码失败: {str(e)}")

# Security scheme
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated user
    """
    token = credentials.credentials
    user = await get_current_user_from_token(token, db)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法验证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to get current active user
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户未激活"
        )
    return current_user

@router.post("/register", response_model=AuthResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db), request: Request = None):
    """
    Register a new user (requires captcha)
    """
    try:
        # 验证服务端验证码（防止绕过前端）
        from web.backend.captcha import verify_captcha
        client_ip = request.client.host if request and request.client else "unknown"
        if _too_many_fails(client_ip):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="尝试次数过多，请稍后再试")
        if not user_data.captcha_id or not user_data.captcha_answer or not verify_captcha(user_data.captcha_id, user_data.captcha_answer):
            _note_fail(client_ip)
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="验证码无效或已过期")

        # Create user
        user = await create_user(
            db=db,
            username=user_data.username,
            email=user_data.email,
            password=user_data.password
        )
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=access_token_expires
        )
        
        # Convert user to schema
        user_schema = UserSchema.from_orm(user)
        
        return AuthResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_schema
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"注册失败: {str(e)}"
        )

@router.post("/login", response_model=AuthResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db), request: Request = None):
    """
    Login user and return access token (requires captcha)
    """
    # 验证服务端验证码（防止绕过前端）
    from web.backend.captcha import verify_captcha
    client_ip = request.client.host if request and request.client else "unknown"
    if _too_many_fails(client_ip):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="尝试次数过多，请稍后再试")
    if not user_data.captcha_id or not user_data.captcha_answer or not verify_captcha(user_data.captcha_id, user_data.captcha_answer):
        _note_fail(client_ip)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="验证码无效或已过期")

    # Authenticate user
    user = await authenticate_user(db, user_data.username, user_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    # Convert user to schema
    user_schema = UserSchema.from_orm(user)
    
    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_schema
    )

@router.post("/refresh", response_model=Token)
async def refresh_token(current_user: User = Depends(get_current_active_user)):
    """
    Refresh access token for authenticated user
    """
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.username},
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer")

@router.get("/me", response_model=UserSchema)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    Get current user information
    """
    return UserSchema.from_orm(current_user)

@router.post("/logout")
async def logout():
    """
    Logout user (client should discard the token)
    """
    return {"message": "登出成功"}

# Export dependencies for use in other modules
__all__ = ["get_current_user", "get_current_active_user", "router"]