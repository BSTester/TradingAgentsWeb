#!/usr/bin/env python3
"""
Scheduled Task API Routes
定时任务相关的 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select, func
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from web.backend.database import get_db
from web.backend.models import User, ScheduledTask
from web.backend.schemas import (
    ScheduledTaskCreate,
    ScheduledTaskResponse,
    ScheduledTaskUpdate,
    ScheduledTaskListResponse
)
from web.backend.auth_routes import get_current_active_user
from web.backend.utils.market_detector import normalize_ticker, normalize_ticker_with_suffix, validate_ticker, detect_market
from web.backend.services.scheduler_service import get_scheduler_service

router = APIRouter(prefix="/api/scheduled-tasks", tags=["scheduled-tasks"])

# Maximum number of scheduled tasks per user
MAX_TASKS_PER_USER = 100


@router.post("/", response_model=ScheduledTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_scheduled_task(
    request: ScheduledTaskCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new scheduled task
    
    If execution_cycle and execution_time are provided, the task will be scheduled.
    Otherwise, it will execute immediately (not implemented in this endpoint).
    """
    
    # Check if both execution_cycle and execution_time are provided
    if not request.execution_cycle or not request.execution_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建定时任务需要同时提供执行周期和执行时间"
        )
    
    # Validate interval_days for every_n_days cycle
    if request.execution_cycle == 'every_n_days' and not request.interval_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="选择'每N天执行'时必须指定间隔天数"
        )
    
    # Validate day_of_week for weekly cycle
    if request.execution_cycle == 'weekly' and not request.day_of_week:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="选择'每周执行'时必须指定星期几"
        )
    
    # Check user's task limit
    stmt = select(func.count(ScheduledTask.id)).filter(
        ScheduledTask.user_id == current_user.id,
        ScheduledTask.status == 'pending'
    )
    result = await db.execute(stmt)
    task_count = result.scalar()
    
    if task_count >= MAX_TASKS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum number of scheduled tasks ({MAX_TASKS_PER_USER}) reached. Please delete some tasks before creating new ones."
        )
    
    # Normalize and validate ticker
    ticker = normalize_ticker(request.ticker)
    
    if not validate_ticker(ticker):
        error_msg = f"Invalid ticker format: {request.ticker}\n\n"
        error_msg += "Supported formats:\n"
        error_msg += "• US stocks: 1-5 letters (e.g., AAPL, TSLA)\n"
        error_msg += "• HK stocks: 4-5 digits or with .HK suffix (e.g., 0700, 00700.HK)\n"
        error_msg += "• CN stocks: 6 digits with optional .SH/.SZ suffix (e.g., 600519, 000001.SZ)"
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Standardize ticker (auto-add .HK for HK stocks)
    ticker = normalize_ticker_with_suffix(ticker)
    
    # Detect market
    market = detect_market(ticker)
    
    # Generate unique scheduler job ID
    scheduler_job_id = f"scheduled_task_{current_user.id}_{uuid.uuid4().hex[:8]}"
    
    # Parse end_date if provided
    end_date_dt = None
    if request.end_date:
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone('Asia/Shanghai')
        
        # Parse date and set to end of day in Beijing time
        end_date_dt = datetime.strptime(request.end_date, '%Y-%m-%d').replace(
            hour=23, minute=59, second=59
        )
        end_date_dt = beijing_tz.localize(end_date_dt)
        
        # Check if end date is in the past
        now_beijing = datetime.now(beijing_tz)
        if end_date_dt < now_beijing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date cannot be in the past"
            )
    
    # Create scheduled task record
    scheduled_task = ScheduledTask(
        user_id=current_user.id,
        task_name=request.task_name,
        ticker=ticker,
        market=market,
        analysts=request.analysts,
        research_depth=request.research_depth,
        llm_provider=request.llm_provider,
        shallow_thinker=request.shallow_thinker,
        deep_thinker=request.deep_thinker,
        backend_url=request.backend_url,
        is_public=request.is_public,
        enable_trading_executor=request.enable_trading_executor,
        futu_api_base_url=request.futu_api_base_url,
        futu_api_key=request.futu_api_key,
        execution_cycle=request.execution_cycle,
        execution_time=request.execution_time,
        interval_days=request.interval_days,
        day_of_week=request.day_of_week,
        end_date=end_date_dt,
        is_enabled=True,
        status='pending',
        scheduler_job_id=scheduler_job_id,
        total_executions=0
    )
    
    db.add(scheduled_task)
    await db.commit()
    await db.refresh(scheduled_task)
    
    # Add to scheduler
    try:
        scheduler = get_scheduler_service()
        scheduler.add_scheduled_task(
            task_id=scheduled_task.id,
            job_id=scheduler_job_id,
            execution_cycle=request.execution_cycle,
            execution_time=request.execution_time,
            interval_days=request.interval_days,
            day_of_week=request.day_of_week,
            end_date=end_date_dt
        )
        
        # Get next run time
        next_run = scheduler.get_next_run_time(scheduler_job_id)
        if next_run:
            # Check if next run is after end date
            if end_date_dt:
                from pytz import timezone as pytz_timezone
                beijing_tz = pytz_timezone('Asia/Shanghai')
                
                # Ensure next_run is timezone-aware
                if next_run.tzinfo is None:
                    next_run_aware = beijing_tz.localize(next_run)
                else:
                    next_run_aware = next_run.astimezone(beijing_tz)
                
                if next_run_aware > end_date_dt:
                    # Task will never run, mark as completed immediately
                    scheduled_task.status = 'completed'
                    scheduler.remove_scheduled_task(scheduler_job_id)
                    await db.commit()
                    await db.refresh(scheduled_task)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"无法创建任务。首次执行时间({next_run_aware.strftime('%Y-%m-%d %H:%M')})晚于结束日期({end_date_dt.strftime('%Y-%m-%d')})。请调整执行时间或结束日期。"
                    )
            
            scheduled_task.next_run_time = next_run
            await db.commit()
            await db.refresh(scheduled_task)
        
        print(f"✅ Created scheduled task {scheduled_task.id} for user {current_user.id}")
        
    except Exception as e:
        # Rollback database if scheduler fails
        await db.delete(scheduled_task)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to schedule task: {str(e)}"
        )
    
    return scheduled_task


@router.get("/", response_model=ScheduledTaskListResponse)
async def list_scheduled_tasks(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, description="Filter by status: pending, completed, or all"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all scheduled tasks for the current user
    
    Returns both pending and completed tasks.
    Use status_filter to filter by status: 'pending', 'completed', or None for all.
    """
    
    # Build base query
    base_filter = [ScheduledTask.user_id == current_user.id]
    
    # Add status filter if specified
    if status_filter == 'pending':
        base_filter.append(ScheduledTask.status == 'pending')
    elif status_filter == 'completed':
        base_filter.append(ScheduledTask.status == 'completed')
    # If status_filter is None or 'all', don't add status filter
    
    # Count total tasks
    count_stmt = select(func.count(ScheduledTask.id)).filter(*base_filter)
    result = await db.execute(count_stmt)
    total = result.scalar()
    
    # Get statistics for all tasks (not filtered by status_filter)
    all_tasks_filter = [ScheduledTask.user_id == current_user.id]
    
    # Count enabled tasks (pending + enabled)
    enabled_stmt = select(func.count(ScheduledTask.id)).filter(
        *all_tasks_filter,
        ScheduledTask.status == 'pending',
        ScheduledTask.is_enabled == True
    )
    result = await db.execute(enabled_stmt)
    enabled_count = result.scalar()
    
    # Count paused tasks (pending + not enabled)
    paused_stmt = select(func.count(ScheduledTask.id)).filter(
        *all_tasks_filter,
        ScheduledTask.status == 'pending',
        ScheduledTask.is_enabled == False
    )
    result = await db.execute(paused_stmt)
    paused_count = result.scalar()
    
    # Count completed tasks
    completed_stmt = select(func.count(ScheduledTask.id)).filter(
        *all_tasks_filter,
        ScheduledTask.status == 'completed'
    )
    result = await db.execute(completed_stmt)
    completed_count = result.scalar()
    
    # Get paginated tasks
    offset = (page - 1) * limit
    stmt = select(ScheduledTask).filter(*base_filter).order_by(
        desc(ScheduledTask.created_at)
    ).offset(offset).limit(limit)
    
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    
    return ScheduledTaskListResponse(
        items=tasks,
        total=total,
        page=page,
        limit=limit,
        has_next=(page * limit) < total,
        has_prev=page > 1,
        stats={
            "enabled": enabled_count,
            "paused": paused_count,
            "completed": completed_count
        }
    )


@router.get("/{task_id}", response_model=ScheduledTaskResponse)
async def get_scheduled_task(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get details of a specific scheduled task"""
    
    stmt = select(ScheduledTask).filter(
        ScheduledTask.id == task_id,
        ScheduledTask.user_id == current_user.id
    )
    result = await db.execute(stmt)
    task = result.scalars().first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled task not found"
        )
    
    return task


@router.patch("/{task_id}", response_model=ScheduledTaskResponse)
async def update_scheduled_task(
    task_id: int,
    update_data: ScheduledTaskUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a scheduled task
    
    Can update:
    - is_enabled: Enable or disable the task
    - task_name: Rename the task
    """
    
    stmt = select(ScheduledTask).filter(
        ScheduledTask.id == task_id,
        ScheduledTask.user_id == current_user.id
    )
    result = await db.execute(stmt)
    task = result.scalars().first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled task not found"
        )
    
    # Check if task is completed
    if task.status == 'completed':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a completed task. Completed tasks can only be deleted."
        )
    
    # Update fields
    if update_data.task_name is not None:
        task.task_name = update_data.task_name
    
    if update_data.is_enabled is not None:
        old_enabled = task.is_enabled
        
        # If trying to enable the task, check if it has expired
        if update_data.is_enabled and not old_enabled:
            from pytz import timezone as pytz_timezone
            beijing_tz = pytz_timezone('Asia/Shanghai')
            now_beijing = datetime.now(beijing_tz)
            
            # Check if task has passed end date
            if task.end_date:
                # Ensure end_date is timezone-aware
                if task.end_date.tzinfo is None:
                    end_date_aware = beijing_tz.localize(task.end_date)
                else:
                    end_date_aware = task.end_date.astimezone(beijing_tz)
                
                if now_beijing > end_date_aware:
                    # Task has expired, mark as completed
                    task.status = 'completed'
                    task.next_run_time = None
                    task.is_enabled = False
                    
                    # Remove from scheduler if exists
                    try:
                        scheduler = get_scheduler_service()
                        scheduler.remove_scheduled_task(task.scheduler_job_id)
                    except Exception:
                        pass
                    
                    # Update timestamp
                    task.updated_at = now_beijing
                    await db.commit()
                    await db.refresh(task)
                    
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"任务已过期,无法启用。结束日期为 {end_date_aware.strftime('%Y-%m-%d')},当前时间已超过此日期。任务已自动标记为已完成。"
                    )
            
            # Re-create the job to calculate fresh next run time
            try:
                scheduler = get_scheduler_service()
                
                # Remove existing job (if any)
                try:
                    scheduler.remove_scheduled_task(task.scheduler_job_id)
                except Exception:
                    pass
                
                # Create new job with current time as reference
                scheduler.add_scheduled_task(
                    task_id=task.id,
                    job_id=task.scheduler_job_id,
                    execution_cycle=task.execution_cycle,
                    execution_time=task.execution_time,
                    interval_days=task.interval_days,
                    day_of_week=task.day_of_week,
                    end_date=task.end_date
                )
                
                # Get the calculated next run time
                next_run = scheduler.get_next_run_time(task.scheduler_job_id)
                
                if not next_run:
                    # No next run scheduled (shouldn't happen, but handle it)
                    task.status = 'completed'
                    task.next_run_time = None
                    task.is_enabled = False
                    
                    task.updated_at = now_beijing
                    await db.commit()
                    await db.refresh(task)
                    
                    # Provide more detailed error message
                    if task.end_date:
                        detail_msg = f"任务的所有执行时间都已超过结束日期({task.end_date.strftime('%Y-%m-%d')}),无法启用。任务已自动标记为已完成。"
                    else:
                        detail_msg = "根据当前配置无法计算有效的执行时间,请检查任务配置。任务已自动标记为已完成。"
                    
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=detail_msg
                    )
                
                # Check if next run is after end date
                if task.end_date:
                    # Ensure next_run is timezone-aware
                    if next_run.tzinfo is None:
                        next_run_aware = beijing_tz.localize(next_run)
                    else:
                        next_run_aware = next_run.astimezone(beijing_tz)
                    
                    # Ensure end_date is timezone-aware
                    if task.end_date.tzinfo is None:
                        end_date_aware = beijing_tz.localize(task.end_date)
                    else:
                        end_date_aware = task.end_date.astimezone(beijing_tz)
                    
                    if next_run_aware > end_date_aware:
                        # Next run is after end date, mark as completed
                        task.status = 'completed'
                        task.next_run_time = None
                        task.is_enabled = False
                        scheduler.remove_scheduled_task(task.scheduler_job_id)
                        
                        # Update timestamp
                        task.updated_at = now_beijing
                        await db.commit()
                        await db.refresh(task)
                        
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"无法启用任务。下次执行时间为 {next_run_aware.strftime('%Y-%m-%d %H:%M')},已超过结束日期 {end_date_aware.strftime('%Y-%m-%d')}。任务已自动标记为已完成。"
                        )
                
                # Update next run time in database
                task.next_run_time = next_run
                print(f"✅ Calculated next run time for task {task_id}: {next_run}")
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Failed to recreate scheduler job: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to enable task: {str(e)}"
                )
        
        task.is_enabled = update_data.is_enabled
        
        # Handle disabling (pausing) the task
        if not update_data.is_enabled and old_enabled:
            try:
                scheduler = get_scheduler_service()
                scheduler.pause_scheduled_task(task.scheduler_job_id)
                print(f"⏸️  Disabled scheduled task {task_id}")
            except Exception as e:
                print(f"⚠️  Failed to pause task: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to disable task: {str(e)}"
                )
    
    # Update timestamp (use Beijing time)
    from pytz import timezone as pytz_timezone
    beijing_tz = pytz_timezone('Asia/Shanghai')
    task.updated_at = datetime.now(beijing_tz)
    await db.commit()
    await db.refresh(task)
    
    return task


@router.delete("/{task_id}")
async def delete_scheduled_task(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a scheduled task"""
    
    stmt = select(ScheduledTask).filter(
        ScheduledTask.id == task_id,
        ScheduledTask.user_id == current_user.id
    )
    result = await db.execute(stmt)
    task = result.scalars().first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="定时任务不存在"
        )
    
    task_name = task.task_name
    task_status = task.status
    
    # Remove from scheduler
    scheduler_removed = False
    try:
        scheduler = get_scheduler_service()
        scheduler.remove_scheduled_task(task.scheduler_job_id)
        scheduler_removed = True
    except Exception as e:
        print(f"⚠️  Failed to remove task from scheduler: {e}")
        # Continue with database deletion even if scheduler fails
    
    # Delete from database
    await db.delete(task)
    await db.commit()
    
    print(f"✅ Deleted scheduled task {task_id}")
    
    return {
        "success": True,
        "message": f"定时任务 '{task_name}' 已成功删除",
        "task_id": task_id,
        "task_name": task_name,
        "task_status": task_status,
        "scheduler_removed": scheduler_removed
    }
