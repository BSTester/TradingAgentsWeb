#!/usr/bin/env python3
"""
Decorators for authentication and authorization in TradingAgents Web Interface
"""

from functools import wraps
from typing import Callable, Optional
from fastapi import HTTPException, status, Request, Depends
from sqlalchemy.orm import Session
from web.backend.database import get_db
from web.backend.models import User, AnalysisRecord
from web.backend.middleware import require_active_user

def require_authentication(func: Callable) -> Callable:
    """
    Decorator to require user authentication
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract request from args/kwargs
        request = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break
        
        if not request:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Request object not found"
            )
        
        # Check authentication
        user = require_active_user(request)
        
        # Add user to kwargs for the function
        kwargs['current_user'] = user
        
        return await func(*args, **kwargs)
    
    return wrapper

def require_analysis_ownership(func: Callable) -> Callable:
    """
    Decorator to ensure user owns the analysis record
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract analysis_id from kwargs
        analysis_id = kwargs.get('analysis_id')
        if not analysis_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Analysis ID is required"
            )
        
        # Extract current_user (should be set by require_authentication)
        current_user = kwargs.get('current_user')
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # Get database session
        db = None
        for arg in args:
            if isinstance(arg, Session):
                db = arg
                break
        
        if not db:
            # Try to get from dependency injection
            db = next(get_db())
        
        try:
            # Check if analysis exists and belongs to user
            analysis = db.query(AnalysisRecord).filter(
                AnalysisRecord.analysis_id == analysis_id,
                AnalysisRecord.user_id == current_user.id
            ).first()
            
            if not analysis:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Analysis not found or access denied"
                )
            
            # Add analysis to kwargs
            kwargs['analysis_record'] = analysis
            
            return await func(*args, **kwargs)
            
        finally:
            if 'db' not in [arg.__class__.__name__ for arg in args]:
                db.close()
    
    return wrapper

class PermissionChecker:
    """
    Class-based permission checker for more complex authorization logic
    """
    
    def __init__(self, require_active: bool = True):
        self.require_active = require_active
    
    def __call__(self, request: Request, db: Session = Depends(get_db)) -> User:
        """
        Check permissions and return current user
        """
        user = require_active_user(request) if self.require_active else require_authentication(request)
        return user

class AnalysisOwnershipChecker:
    """
    Class-based checker for analysis ownership
    """
    
    def __init__(self, analysis_id_param: str = "analysis_id"):
        self.analysis_id_param = analysis_id_param
    
    def __call__(
        self, 
        request: Request, 
        analysis_id: str,
        db: Session = Depends(get_db)
    ) -> tuple[User, AnalysisRecord]:
        """
        Check analysis ownership and return user and analysis record
        """
        # Get current user
        user = require_active_user(request)
        
        # Check analysis ownership
        analysis = db.query(AnalysisRecord).filter(
            AnalysisRecord.analysis_id == analysis_id,
            AnalysisRecord.user_id == user.id
        ).first()
        
        if not analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis not found or access denied"
            )
        
        return user, analysis

# Convenience instances
check_permissions = PermissionChecker()
check_analysis_ownership = AnalysisOwnershipChecker()

# Helper functions for manual permission checking
def check_user_owns_analysis(user: User, analysis_id: str, db: Session) -> AnalysisRecord:
    """
    Check if user owns the specified analysis
    """
    analysis = db.query(AnalysisRecord).filter(
        AnalysisRecord.analysis_id == analysis_id,
        AnalysisRecord.user_id == user.id
    ).first()
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found or access denied"
        )
    
    return analysis

def check_user_can_access_analysis(user: User, analysis_record: AnalysisRecord) -> bool:
    """
    Check if user can access the analysis record
    """
    return analysis_record.user_id == user.id