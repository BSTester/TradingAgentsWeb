#!/usr/bin/env python3
"""
Middleware for TradingAgents Web Interface
"""

import time
from typing import Optional
from fastapi import Request, Response, HTTPException, status
from fastapi.security.utils import get_authorization_scheme_param
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlalchemy.orm import Session
from web.backend.database import SessionLocal
from web.backend.auth import get_current_user_from_token
from web.backend.models import User

class AuthMiddleware(BaseHTTPMiddleware):
    """
    Authentication middleware to protect routes
    """
    
    # Routes that don't require authentication
    EXEMPT_PATHS = {
        "/",
        "/static",
        "/api/config",
        "/api/validate-key",
        "/api/auth/register",
        "/api/auth/login",
        "/docs",
        "/redoc",
        "/openapi.json"
    }
    
    async def dispatch(self, request: Request, call_next):
        # Check if path is exempt from authentication
        path = request.url.path
        
        # Allow static files and exempt paths
        if any(path.startswith(exempt) for exempt in self.EXEMPT_PATHS):
            return await call_next(request)
        
        # Allow OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Extract token from Authorization header
        authorization = request.headers.get("Authorization")
        scheme, token = get_authorization_scheme_param(authorization)
        
        if not authorization or scheme.lower() != "bearer":
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Not authenticated"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Validate token and get user
        db = SessionLocal()
        try:
            user = get_current_user_from_token(token, db)
            if not user or not user.is_active:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid authentication credentials"},
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Add user to request state
            request.state.user = user
            
        except Exception:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Could not validate credentials"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        finally:
            db.close()
        
        # Continue with request
        return await call_next(request)

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Logging middleware to track requests
    """
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log request (in production, use proper logging)
        print(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
        
        # Add processing time header
        response.headers["X-Process-Time"] = str(process_time)
        
        return response

class CORSMiddleware(BaseHTTPMiddleware):
    """
    CORS middleware for cross-origin requests
    """
    
    def __init__(self, app, allow_origins=None, allow_methods=None, allow_headers=None):
        super().__init__(app)
        self.allow_origins = allow_origins or ["*"]
        self.allow_methods = allow_methods or ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        self.allow_headers = allow_headers or ["*"]
    
    async def dispatch(self, request: Request, call_next):
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response()
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allow_methods)
            response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allow_headers)
            response.headers["Access-Control-Max-Age"] = "86400"
            return response
        
        # Process request
        response = await call_next(request)
        
        # Add CORS headers
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response

def get_current_user_from_request(request: Request) -> Optional[User]:
    """
    Get current user from request state (set by AuthMiddleware)
    """
    return getattr(request.state, "user", None)

def require_auth(request: Request) -> User:
    """
    Dependency to require authentication and return current user
    """
    user = get_current_user_from_request(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return user

def require_active_user(request: Request) -> User:
    """
    Dependency to require active user
    """
    user = require_auth(request)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    return user