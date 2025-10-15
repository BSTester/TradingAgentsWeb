#!/usr/bin/env python3
"""
Task Management API Routes
任务管理相关的 API 路由
"""

from fastapi import APIRouter, Depends
from web.backend.models import User
from web.backend.auth_routes import get_current_active_user

# 这个需要从 app_v2.py 导入
task_manager = None

router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/tasks/status")
async def get_tasks_status(current_user: User = Depends(get_current_active_user)):
    """Get task manager status (requires authentication)"""
    status = task_manager.get_status()
    return status


def init_task_routes(app_task_manager):
    """Initialize routes with dependencies from main app"""
    global task_manager
    task_manager = app_task_manager
