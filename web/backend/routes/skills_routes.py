#!/usr/bin/env python3
"""
Skills governance routes.
"""

from fastapi import APIRouter, Depends

from web.backend.auth_routes import get_current_active_user
from web.backend.models import User
from web.backend.services.skills import get_skill_registry

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("/health")
async def get_skills_health(current_user: User = Depends(get_current_active_user)):
    """Return internal Skills health and provider routing metadata."""
    return {"data": get_skill_registry().list_health()}
