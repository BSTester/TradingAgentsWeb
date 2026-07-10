#!/usr/bin/env python3
"""
Task executor for scheduled analysis tasks
Handles execution of scheduled tasks and integrates with existing task manager
"""

from datetime import datetime, timezone
from typing import Optional
from web.backend.database import SessionLocal
from web.backend.models import ScheduledTask, AnalysisRecord
from web.backend.services.llm_config_resolver import resolve_llm_config_sync


def execute_scheduled_task(scheduled_task_id: int):
    """
    Execute a scheduled task
    
    This function is called by APScheduler when a scheduled task is triggered.
    It creates an analysis record and submits it to the task manager for execution.
    
    Args:
        scheduled_task_id: Database ID of the scheduled task
    """
    db = SessionLocal()
    
    try:
        # Get scheduled task
        task = db.query(ScheduledTask).filter(
            ScheduledTask.id == scheduled_task_id
        ).first()
        
        if not task:
            print(f"⚠️  Scheduled task {scheduled_task_id} not found")
            return
        
        if not task.is_enabled:
            print(f"⏸️  Scheduled task {scheduled_task_id} is disabled, skipping execution")
            return
        
        # Check if task has reached end date (use Beijing time for consistency)
        if task.end_date:
            from pytz import timezone as pytz_timezone
            beijing_tz = pytz_timezone('Asia/Shanghai')
            now_beijing = datetime.now(beijing_tz)
            
            # Ensure end_date is timezone-aware
            if task.end_date.tzinfo is None:
                # If end_date is naive, assume it's in Beijing time
                end_date_aware = beijing_tz.localize(task.end_date)
            else:
                # Convert to Beijing time for comparison
                end_date_aware = task.end_date.astimezone(beijing_tz)
            
            if now_beijing > end_date_aware:
                print(f"⏰ Scheduled task {scheduled_task_id} has passed end date ({end_date_aware}), marking as completed")
                task.status = 'completed'
                task.next_run_time = None  # Clear next run time
                db.commit()
                
                # Remove from scheduler
                from web.backend.services.scheduler_service import get_scheduler_service
                scheduler = get_scheduler_service()
                scheduler.remove_scheduled_task(task.scheduler_job_id)
                print(f"✅ Task {scheduled_task_id} removed from scheduler due to end date")
                return
        
        # Check if user already has a running task for the same ticker
        running_task = db.query(AnalysisRecord).filter(
            AnalysisRecord.user_id == task.user_id,
            AnalysisRecord.ticker == task.ticker,  # Only check same ticker
            AnalysisRecord.status.in_(["initializing", "running", "queued"])
        ).first()
        
        if running_task:
            print(f"⚠️  User {task.user_id} already has task for {task.ticker}: {running_task.analysis_id}, skipping scheduled task {task.id}")
            # Skip this execution to avoid duplicate analysis of the same ticker
            return
        
        # Update user configuration cache with task settings
        from web.backend.models import UserConfig
        user_config = db.query(UserConfig).filter(UserConfig.user_id == task.user_id).first()
        
        if not user_config:
            user_config = UserConfig(user_id=task.user_id)
            db.add(user_config)

        resolved_llm = resolve_llm_config_sync(
            db,
            user_id=task.user_id,
            llm_provider=task.llm_provider,
            backend_url=task.backend_url,
            shallow_thinker=task.shallow_thinker,
            deep_thinker=task.deep_thinker,
            api_key=task.api_key,
        )
        
        # Cache configuration from scheduled task
        user_config.last_ticker = task.ticker
        user_config.last_analysts = task.analysts
        user_config.last_research_depth = task.research_depth
        user_config.last_llm_provider = resolved_llm.llm_provider
        user_config.last_shallow_thinker = resolved_llm.shallow_thinker
        user_config.last_deep_thinker = resolved_llm.deep_thinker
        user_config.last_backend_url = resolved_llm.backend_url
        
        db.commit()
        print(f"✅ Updated user configuration cache for user {task.user_id}")
        
        # Invalidate cache after updating user config
        from web.backend.services.user_config_cache import invalidate_user_config_cache
        invalidate_user_config_cache(task.user_id)
        
        # Create analysis record (use Beijing time)
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone('Asia/Shanghai')
        now_beijing = datetime.now(beijing_tz)
        
        analysis_id = f"scheduled_{task.id}_{now_beijing.strftime('%Y%m%d_%H%M%S')}"
        
        print(f"✅ Executing scheduled task {task.id}: {task.task_name} (ticker: {task.ticker})")
        
        analysis_record = AnalysisRecord(
            analysis_id=analysis_id,
            user_id=task.user_id,
            ticker=task.ticker,
            market=task.market,
            analysis_date=now_beijing.strftime('%Y-%m-%d'),
            analysts=task.analysts,
            research_depth=task.research_depth,
            llm_provider=resolved_llm.llm_provider,
            shallow_thinker=resolved_llm.shallow_thinker,
            deep_thinker=resolved_llm.deep_thinker,
            backend_url=resolved_llm.backend_url,
            api_key=None,
            is_public=task.is_public,
            email_notification_enabled=task.email_notification_enabled,  # Copy email notification setting
            status="queued"
        )
        db.add(analysis_record)
        db.commit()
        
        # Submit to task manager (will handle user-level queuing automatically)
        from web.backend.app import task_manager
        from web.backend.analysis_task import run_analysis_task
        from web.backend.app import manager as websocket_manager
        
        request_data = {
            'ticker': task.ticker,
            'analysts': task.analysts,
            'research_depth': task.research_depth,
            'llm_provider': resolved_llm.llm_provider,
            'backend_url': resolved_llm.backend_url,
            'shallow_thinker': resolved_llm.shallow_thinker,
            'deep_thinker': resolved_llm.deep_thinker,
            'analysis_date': now_beijing.strftime('%Y-%m-%d'),
            'api_key': resolved_llm.api_key,
        }
        
        # Submit task (task_manager handles user-level queuing)
        task_manager.submit_task(
            analysis_id,
            task.user_id,
            run_analysis_task,
            analysis_id,
            task.user_id,
            request_data,
            websocket_manager,
            task_manager
        )
        
        # Update task statistics (use Beijing time)
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone('Asia/Shanghai')
        task.total_executions += 1
        task.last_run_time = datetime.now(beijing_tz)
        
        # Get next run time from scheduler
        from web.backend.services.scheduler_service import get_scheduler_service
        scheduler = get_scheduler_service()
        next_run = scheduler.get_next_run_time(task.scheduler_job_id)
        
        if next_run:
            # Check if next run is after end date
            if task.end_date:
                # Ensure both datetimes are timezone-aware for comparison
                if task.end_date.tzinfo is None:
                    end_date_aware = beijing_tz.localize(task.end_date)
                else:
                    end_date_aware = task.end_date.astimezone(beijing_tz)
                
                # Ensure next_run is timezone-aware
                if next_run.tzinfo is None:
                    next_run_aware = beijing_tz.localize(next_run)
                else:
                    next_run_aware = next_run.astimezone(beijing_tz)
                
                if next_run_aware > end_date_aware:
                    print(f"⏰ Next run time ({next_run_aware}) is after end date ({end_date_aware}), marking task {task.id} as completed")
                    task.status = 'completed'
                    task.next_run_time = None  # Clear next run time
                    scheduler.remove_scheduled_task(task.scheduler_job_id)
                    print(f"✅ Task {task.id} removed from scheduler - no more runs within end date")
                else:
                    # Next run is valid, update it
                    task.next_run_time = next_run
            else:
                # No end date restriction, just update next run time
                task.next_run_time = next_run
        else:
            # No more runs scheduled (APScheduler returned None)
            print(f"✅ No more runs scheduled for task {task.id}, marking as completed")
            task.status = 'completed'
            task.next_run_time = None
            scheduler.remove_scheduled_task(task.scheduler_job_id)
        
        db.commit()
        print(f"✅ Scheduled task {task.id} execution initiated successfully")
        
    except Exception as e:
        print(f"❌ Scheduled task {scheduled_task_id} execution failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Rollback any pending transaction
        try:
            db.rollback()
        except Exception:
            pass
        
        # Update execution count even on failure
        try:
            # Start a new transaction
            db.begin()
            task = db.query(ScheduledTask).filter(
                ScheduledTask.id == scheduled_task_id
            ).first()
            if task:
                task.total_executions += 1
                db.commit()
        except Exception as update_error:
            print(f"❌ Failed to update execution count: {update_error}")
            try:
                db.rollback()
            except Exception:
                pass
    
    finally:
        try:
            db.close()
        except Exception:
            pass


def calculate_next_run_time(task: ScheduledTask) -> Optional[datetime]:
    """
    Calculate the next run time for a scheduled task
    
    Args:
        task: Scheduled task model
        
    Returns:
        Next run time or None if task should not run again
    """
    from web.backend.services.scheduler_service import get_scheduler_service
    
    try:
        scheduler = get_scheduler_service()
        next_run = scheduler.get_next_run_time(task.scheduler_job_id)
        
        # Check if next run is after end date
        if next_run and task.end_date and next_run > task.end_date:
            return None
        
        return next_run
    except Exception as e:
        print(f"❌ Failed to calculate next run time: {e}")
        return None
