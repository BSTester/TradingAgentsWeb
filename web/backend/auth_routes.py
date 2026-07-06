#!/usr/bin/env python3
"""
Authentication routes for TradingAgents Web Interface
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from web.backend.database import get_db
from web.backend.schemas import (
    UserCreate, UserLogin, AuthResponse, User as UserSchema, Token, CaptchaResponse,
    EmailCodeSendRequest, EmailCodeSendResponse, EmailCodeLoginRequest, PasswordSetRequest
)
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
_EMAIL_CODE_REQUESTS: Dict[str, Deque[float]] = defaultdict(deque)  # 每邮箱的验证码请求时间戳

CAPTCHA_RATE_LIMIT = 20          # 每分钟最多获取20次验证码/每IP
CAPTCHA_RATE_WINDOW = 60         # 秒
FAIL_WINDOW = 600                # 10分钟
FAIL_LIMIT = 5                   # 10分钟内最多失败5次
EMAIL_CODE_RATE_LIMIT = 1        # 每邮箱每60秒最多请求1次
EMAIL_CODE_RATE_WINDOW = 60      # 秒

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

def _check_email_code_rate(email: str) -> bool:
    dq = _EMAIL_CODE_REQUESTS[email]
    _prune(dq, EMAIL_CODE_RATE_WINDOW)
    return len(dq) < EMAIL_CODE_RATE_LIMIT

def _note_email_code_request(email: str):
    dq = _EMAIL_CODE_REQUESTS[email]
    _prune(dq, EMAIL_CODE_RATE_WINDOW)
    dq.append(time.time())

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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用，请联系管理员"
        )
    return current_user

@router.post("/register", response_model=AuthResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db), request: Request = None):
    """
    Register a new user (requires captcha and email verification code)
    """
    try:
        # 验证服务端验证码（防止绕过前端）
        from web.backend.captcha import verify_captcha
        from web.backend.services.verification_code_service import get_verification_code_service
        
        client_ip = request.client.host if request and request.client else "unknown"
        if _too_many_fails(client_ip):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="尝试次数过多，请稍后再试")
        if not user_data.captcha_id or not user_data.captcha_answer or not verify_captcha(user_data.captcha_id, user_data.captcha_answer):
            _note_fail(client_ip)
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="图形验证码无效或已过期")
        
        # Verify email code
        if not user_data.email_code:
            _note_fail(client_ip)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请输入邮箱验证码"
            )
        
        verification_service = get_verification_code_service(db)
        code_valid = await verification_service.verify_code(
            email=user_data.email,
            code=user_data.email_code
        )
        
        if not code_valid:
            _note_fail(client_ip)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="邮箱验证码错误或已过期"
            )

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

@router.post("/set-password")
async def set_password(
    request_data: PasswordSetRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Set or update user password
    Requires authentication
    If user has already set password, old_password is required
    """
    from web.backend.auth import get_password_hash, verify_password
    
    try:
        # If user has already set a password, require old password for verification
        if current_user.has_set_password:
            if not request_data.old_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="修改密码需要输入旧密码"
                )
            
            # Verify old password
            if not verify_password(request_data.old_password, current_user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="旧密码错误"
                )
        
        # Update user password
        current_user.hashed_password = get_password_hash(request_data.password)
        current_user.has_set_password = True
        await db.commit()
        
        return {"message": "密码设置成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"设置密码失败: {str(e)}"
        )

@router.post("/email-code/send", response_model=EmailCodeSendResponse)
async def send_email_code(
    request_data: EmailCodeSendRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Send verification code to user's email
    Requires CAPTCHA validation and rate limiting
    """
    from web.backend.captcha import verify_captcha
    from web.backend.services.verification_code_service import get_verification_code_service
    from sqlalchemy import select
    
    client_ip = request.client.host if request.client else "unknown"
    
    # Check if too many failed attempts
    if _too_many_fails(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="尝试次数过多，请稍后再试"
        )
    
    # Validate CAPTCHA
    if not verify_captcha(request_data.captcha_id, request_data.captcha_answer):
        _note_fail(client_ip)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="验证码无效或已过期"
        )
    
    # Check email rate limiting
    if not _check_email_code_rate(request_data.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请60秒后再试"
        )
    
    # Check if email exists
    result = await db.execute(
        select(User).where(User.email == request_data.email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        _note_fail(client_ip)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱未注册"
        )
    
    # Generate and send verification code
    verification_service = get_verification_code_service(db)
    success = await verification_service.generate_and_send_code(
        email=request_data.email,
        ip_address=client_ip
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="邮件发送失败，请稍后重试"
        )
    
    # Note the request for rate limiting
    _note_email_code_request(request_data.email)
    
    return EmailCodeSendResponse(
        message="验证码已发送到您的邮箱",
        expires_in=300  # 5 minutes
    )

@router.post("/email-code/send-for-register", response_model=EmailCodeSendResponse)
async def send_email_code_for_register(
    request_data: EmailCodeSendRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Send verification code for registration
    Requires CAPTCHA validation and rate limiting
    Checks that email is NOT already registered
    """
    from web.backend.captcha import verify_captcha
    from web.backend.services.verification_code_service import VerificationCodeService
    from sqlalchemy import select
    
    client_ip = request.client.host if request.client else "unknown"
    
    # Check if too many failed attempts
    if _too_many_fails(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="尝试次数过多，请稍后再试"
        )
    
    # Validate CAPTCHA
    if not verify_captcha(request_data.captcha_id, request_data.captcha_answer):
        _note_fail(client_ip)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="验证码无效或已过期"
        )
    
    # Check email rate limiting
    if not _check_email_code_rate(request_data.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请60秒后再试"
        )
    
    # Check if email already exists (for registration, email should NOT exist)
    result = await db.execute(
        select(User).where(User.email == request_data.email)
    )
    user = result.scalar_one_or_none()
    
    if user:
        _note_fail(client_ip)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册，请直接登录"
        )
    
    # Generate and send verification code (without checking if user exists)
    # For registration, we don't need to check if user exists
    # Just generate code and send email
    import random
    from web.backend.services.verification_code_service import get_verification_code_service
    
    try:
        verification_service = get_verification_code_service(db)
        
        # Generate new code
        code = verification_service._generate_code()
        code_hash = verification_service._hash_code(code)
        
        # Calculate expiration time (5 minutes from now)
        from datetime import datetime, timedelta, timezone
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        
        # Store in memory (using the same storage as verification_code_service)
        from web.backend.services.verification_code_service import _verification_codes, _codes_lock
        with _codes_lock:
            _verification_codes[request_data.email] = (code_hash, expires_at, False)
        
        print(f"📧 [VerificationCode] Generated code for registration: {request_data.email}")
        
        # Send email with verification code
        success = await verification_service._send_verification_email(request_data.email, code)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="邮件发送失败，请稍后重试"
            )
        
        # Note the request for rate limiting
        _note_email_code_request(request_data.email)
        
        return EmailCodeSendResponse(
            message="验证码已发送到您的邮箱",
            expires_in=300  # 5 minutes
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [VerificationCode] Error generating code for registration: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="发送验证码失败，请稍后重试"
        )

@router.post("/email-code/login", response_model=AuthResponse)
async def login_with_email_code(
    request_data: EmailCodeLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Login user with email and verification code
    Requires CAPTCHA validation
    """
    from web.backend.captcha import verify_captcha
    from web.backend.services.verification_code_service import get_verification_code_service
    from sqlalchemy import select
    
    client_ip = request.client.host if request.client else "unknown"
    
    # Check if too many failed attempts
    if _too_many_fails(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="尝试次数过多，请稍后再试"
        )
    
    # Validate CAPTCHA
    if not verify_captcha(request_data.captcha_id, request_data.captcha_answer):
        _note_fail(client_ip)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="验证码无效或已过期"
        )
    
    # Verify email code
    verification_service = get_verification_code_service(db)
    code_valid = await verification_service.verify_code(
        email=request_data.email,
        code=request_data.code
    )
    
    if not code_valid:
        _note_fail(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="验证码错误或已过期"
        )
    
    # Get user by email
    result = await db.execute(
        select(User).where(User.email == request_data.email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        _note_fail(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户未激活"
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

# Export dependencies for use in other modules
__all__ = ["get_current_user", "get_current_active_user", "require_intraday_access", "router"]