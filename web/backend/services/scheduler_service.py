#!/usr/bin/env python3
"""
Scheduler service for managing scheduled analysis tasks using APScheduler
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.job import Job
from apscheduler.jobstores.base import JobLookupError


class SchedulerService:
    """Service for managing scheduled tasks with APScheduler"""
    
    def __init__(self, db_url: str):
        """
        Initialize scheduler with database job store
        
        Args:
            db_url: Database URL for job store (sync URL)
        """
        # Convert async database URL to sync for APScheduler
        sync_db_url = self._get_sync_db_url(db_url)
        
        # Configure job stores
        jobstores = {
            'default': SQLAlchemyJobStore(url=sync_db_url)
        }
        
        # Configure executors
        executors = {
            'default': ThreadPoolExecutor(max_workers=10)
        }
        
        # Configure job defaults
        job_defaults = {
            'coalesce': True,  # Combine missed runs into one
            'max_instances': 1,  # One instance per job at a time
            'misfire_grace_time': 3600  # 1 hour grace period for missed jobs
        }
        
        # Create scheduler with Beijing timezone
        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone='Asia/Shanghai'  # Beijing time (UTC+8)
        )
        
        self._started = False
    
    def _get_sync_db_url(self, async_url: str) -> str:
        """Convert async database URL to sync URL for APScheduler"""
        if async_url.startswith("mysql+aiomysql"):
            return async_url.replace("+aiomysql", "+pymysql")
        elif async_url.startswith("sqlite+aiosqlite"):
            return async_url.replace("+aiosqlite", "")
        return async_url
    
    def start(self):
        """Start the scheduler"""
        if not self._started:
            self.scheduler.start()
            self._started = True
            print("✅ Scheduler service started")
    
    def shutdown(self, wait: bool = True):
        """
        Shutdown the scheduler
        
        Args:
            wait: Whether to wait for running jobs to complete
        """
        if self._started:
            self.scheduler.shutdown(wait=wait)
            self._started = False
            print("✅ Scheduler service stopped")
    
    def add_scheduled_task(self, task_id: int, job_id: str, execution_cycle: str, 
                          execution_time: str, interval_days: Optional[int] = None,
                          day_of_week: Optional[str] = None,
                          start_date: Optional[datetime] = None,
                          end_date: Optional[datetime] = None) -> str:
        """
        Add a new scheduled task to the scheduler
        
        Args:
            task_id: Database ID of the scheduled task
            job_id: Unique job ID for APScheduler
            execution_cycle: Type of schedule (daily, weekly, every_n_days, workdays)
            execution_time: Time to execute in HH:MM format (Beijing time)
            interval_days: Number of days for every_n_days cycle
            day_of_week: Day of week for weekly cycle (0-6, 0=Sunday)
            start_date: Start date for the schedule
            end_date: End date for the schedule (task will not run after this date)
            
        Returns:
            Job ID of the added job
        """
        # Import here to avoid circular dependency
        from web.backend.services.task_executor import execute_scheduled_task
        
        # Create trigger based on execution cycle
        trigger = self._create_trigger(
            execution_cycle, 
            execution_time, 
            interval_days,
            day_of_week,
            start_date,
            end_date
        )
        
        # Add job to scheduler with end_date if provided
        job_kwargs = {
            'func': execute_scheduled_task,
            'trigger': trigger,
            'args': [task_id],
            'id': job_id,
            'replace_existing': True,
            'name': f"Scheduled Task {task_id}"
        }
        
        # APScheduler will automatically stop scheduling after end_date
        if end_date:
            job_kwargs['end_date'] = end_date
        
        job = self.scheduler.add_job(**job_kwargs)
        
        print(f"✅ Added scheduled task: {job_id} (next run: {job.next_run_time})")
        return job.id
    
    def remove_scheduled_task(self, job_id: str) -> bool:
        """
        Remove a scheduled task from the scheduler
        
        Args:
            job_id: Job ID to remove
            
        Returns:
            True if removed, False if not found
        """
        try:
            self.scheduler.remove_job(job_id)
            print(f"✅ Removed scheduled task: {job_id}")
            return True
        except JobLookupError:
            print(f"⚠️  Job not found: {job_id}")
            return False
    
    def pause_scheduled_task(self, job_id: str) -> bool:
        """
        Pause a scheduled task
        
        Args:
            job_id: Job ID to pause
            
        Returns:
            True if paused, False if not found
        """
        try:
            self.scheduler.pause_job(job_id)
            print(f"⏸️  Paused scheduled task: {job_id}")
            return True
        except JobLookupError:
            print(f"⚠️  Job not found: {job_id}")
            return False
    
    def resume_scheduled_task(self, job_id: str) -> bool:
        """
        Resume a paused scheduled task
        
        Args:
            job_id: Job ID to resume
            
        Returns:
            True if resumed, False if not found
        """
        try:
            self.scheduler.resume_job(job_id)
            print(f"▶️  Resumed scheduled task: {job_id}")
            return True
        except JobLookupError:
            print(f"⚠️  Job not found: {job_id}")
            return False
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """
        Get a job by ID
        
        Args:
            job_id: Job ID to retrieve
            
        Returns:
            Job object or None if not found
        """
        try:
            return self.scheduler.get_job(job_id)
        except JobLookupError:
            return None
    
    def get_next_run_time(self, job_id: str) -> Optional[datetime]:
        """
        Get the next run time for a job
        
        Args:
            job_id: Job ID to check
            
        Returns:
            Next run time or None if not found
        """
        job = self.get_job(job_id)
        return job.next_run_time if job else None
    
    def _create_trigger(self, execution_cycle: str, execution_time: str, 
                       interval_days: Optional[int] = None,
                       day_of_week: Optional[str] = None,
                       start_date: Optional[datetime] = None,
                       end_date: Optional[datetime] = None):
        """
        Create APScheduler trigger based on task configuration
        
        Args:
            execution_cycle: Type of schedule
            execution_time: Time in HH:MM format (Beijing time)
            interval_days: Days interval for every_n_days
            day_of_week: Day of week for weekly cycle (0-6, 0=Sunday)
            start_date: Start date for the schedule
            end_date: End date for the schedule
            
        Returns:
            APScheduler trigger object
        """
        # Parse execution time
        hour, minute = map(int, execution_time.split(':'))
        
        if execution_cycle == 'daily':
            # Run every day at specified time (Beijing time)
            trigger_kwargs = {
                'hour': hour,
                'minute': minute,
                'timezone': 'Asia/Shanghai'
            }
            if end_date:
                trigger_kwargs['end_date'] = end_date
            return CronTrigger(**trigger_kwargs)
        
        elif execution_cycle == 'weekly':
            # Run on specified day of week at specified time (Beijing time)
            # Convert day_of_week (0-6, 0=Sunday) to cron format
            if not day_of_week:
                day_of_week = '1'  # Default to Monday if not specified
            
            # APScheduler uses 0=Monday, 6=Sunday, but we use 0=Sunday, 1-6=Mon-Sat
            # So we need to convert: our 0 (Sun) -> 6, our 1-6 (Mon-Sat) -> 0-5
            day_int = int(day_of_week)
            if day_int == 0:  # Sunday
                cron_day = 6
            else:  # Monday-Saturday
                cron_day = day_int - 1
            
            trigger_kwargs = {
                'day_of_week': cron_day,
                'hour': hour,
                'minute': minute,
                'timezone': 'Asia/Shanghai'
            }
            if end_date:
                trigger_kwargs['end_date'] = end_date
            return CronTrigger(**trigger_kwargs)
        
        elif execution_cycle == 'workdays':
            # Run Monday to Friday at specified time (Beijing time)
            trigger_kwargs = {
                'day_of_week': '0-4',  # Monday=0 to Friday=4 in APScheduler
                'hour': hour,
                'minute': minute,
                'timezone': 'Asia/Shanghai'
            }
            if end_date:
                trigger_kwargs['end_date'] = end_date
            return CronTrigger(**trigger_kwargs)
        
        elif execution_cycle == 'every_n_days':
            # Run every N days at specified time (Beijing time)
            if not interval_days:
                raise ValueError("interval_days is required for every_n_days cycle")
            
            # Calculate start date with the specified time (Beijing time)
            if not start_date:
                from pytz import timezone as pytz_timezone
                beijing_tz = pytz_timezone('Asia/Shanghai')
                start_date = datetime.now(beijing_tz).replace(
                    hour=hour,
                    minute=minute,
                    second=0,
                    microsecond=0
                )
                # If the time has passed today, start tomorrow
                if start_date <= datetime.now(beijing_tz):
                    start_date += timedelta(days=1)
            
            trigger_kwargs = {
                'days': interval_days,
                'start_date': start_date,
                'timezone': 'Asia/Shanghai'
            }
            if end_date:
                trigger_kwargs['end_date'] = end_date
            return IntervalTrigger(**trigger_kwargs)
        
        else:
            raise ValueError(f"Unknown execution cycle: {execution_cycle}")
    
    def get_all_jobs(self):
        """Get all scheduled jobs"""
        return self.scheduler.get_jobs()
    
    def print_jobs(self):
        """Print all scheduled jobs for debugging"""
        jobs = self.get_all_jobs()
        if not jobs:
            print("📋 No scheduled jobs")
            return
        
        print(f"📋 Scheduled jobs ({len(jobs)}):")
        for job in jobs:
            print(f"  - {job.id}: next run at {job.next_run_time}")


# Global scheduler instance (will be initialized in app startup)
scheduler_service: Optional[SchedulerService] = None


def get_scheduler_service() -> SchedulerService:
    """Get the global scheduler service instance"""
    if scheduler_service is None:
        raise RuntimeError("Scheduler service not initialized")
    return scheduler_service


def init_scheduler_service(db_url: str) -> SchedulerService:
    """
    Initialize the global scheduler service
    
    Args:
        db_url: Database URL for job store
        
    Returns:
        Initialized scheduler service
    """
    global scheduler_service
    scheduler_service = SchedulerService(db_url)
    return scheduler_service
