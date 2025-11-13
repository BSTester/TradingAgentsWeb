#!/usr/bin/env python3
"""
Intraday Trading Scheduler - Core Scheduler Class

This module contains the IntradayScheduler class which handles the scheduling
logic for a single user's intraday trading analysis.

Architecture:
    - IntradayScheduler: Core scheduler class (this file)
    - UserIntradaySchedulerManager: Manages multiple user schedulers (user_intraday_scheduler.py)
    - IntradayExecutor: Executes the actual analysis (intraday_executor.py)

Usage:
    This class should NOT be instantiated directly in most cases.
    Use UserIntradaySchedulerManager.create_scheduler() instead.

Example:
    # Don't do this:
    # scheduler = IntradayScheduler(interval_minutes=5, market_type="US", user_id=1)
    
    # Do this instead:
    from web.backend.services.user_intraday_scheduler import get_manager
    manager = get_manager()
    scheduler = await manager.create_scheduler(user_id=1, interval_minutes=5, market_type="US")
"""

import asyncio
import logging
from datetime import datetime, time
from typing import Optional
import pytz
from tradingagents.agents.utils.market_utils import is_market_open

# Get logger for this module
logger = logging.getLogger(__name__)


class IntradayScheduler:
    """
    Scheduler for intraday trading agent execution.
    Runs analysis at configured intervals during market hours.
    """
    
    def __init__(self, interval_minutes: int = 5, market_type: str = "US,HK,CN", user_id: Optional[int] = None):
        """
        Initialize intraday scheduler.
        
        Args:
            interval_minutes: Minutes between analysis runs (default: 5)
            market_type: Market to monitor. Single market (US/HK/CN) or comma-separated (US,HK,CN)
            user_id: User ID for this scheduler (optional)
        """
        self.interval_minutes = interval_minutes
        self.market_type = market_type
        self.user_id = user_id
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._next_run_time: Optional[datetime] = None  # Track actual next run time
        self._analysis_tasks: dict[str, asyncio.Task] = {}  # Track running analysis tasks by market
        
        # Market timezones
        self.market_timezones = {
            "US": pytz.timezone("America/New_York"),
            "HK": pytz.timezone("Asia/Hong_Kong"),
            "CN": pytz.timezone("Asia/Shanghai"),
        }
        
        # All markets to monitor (in order)
        self.all_markets = ["US", "HK", "CN"]
        
        logger.info(f"📋 IntradayScheduler initialized: interval={interval_minutes}min, market={market_type}, user={user_id}")
    
    async def start(self):
        """Start the scheduler"""
        if self.is_running:
            logger.warning(f"⚠️  IntradayScheduler is already running for user {self.user_id}")
            return
        
        logger.info(f"Starting scheduler for user {self.user_id}")
        
        self.is_running = True
        self._stop_event.clear()
        
        # Set initial next run time to now (will execute immediately)
        self._next_run_time = datetime.now()
        
        self._task = asyncio.create_task(self._run_loop())
    
    async def stop(self):
        """Stop the scheduler and cancel all running analysis tasks"""
        if not self.is_running:
            logger.warning("IntradayScheduler is not running")
            return
        
        logger.info(f"🛑 Stopping scheduler for user {self.user_id}...")
        
        self.is_running = False
        self._stop_event.set()
        self._next_run_time = None  # Clear next run time
        
        # Cancel all running analysis tasks
        if self._analysis_tasks:
            logger.info(f"Cancelling {len(self._analysis_tasks)} running analysis task(s)...")
            for market, task in list(self._analysis_tasks.items()):
                if not task.done():
                    logger.info(f"  Cancelling {market} analysis task...")
                    task.cancel()
            
            # Wait for all tasks to complete cancellation
            if self._analysis_tasks:
                await asyncio.gather(*self._analysis_tasks.values(), return_exceptions=True)
            
            self._analysis_tasks.clear()
        
        # Stop the main scheduler loop
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("IntradayScheduler stop timeout, cancelling task")
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
        
        logger.info(f"⏹️  IntradayScheduler stopped for user {self.user_id}")
    
    async def _run_loop(self):
        """Main scheduler loop - checks and analyzes all markets in sequence"""
        # Execute immediately on first run
        first_run = True
        
        while not self._stop_event.is_set():
            try:
                
                # If not first run, wait for the interval
                if not first_run:
                    # Wait for next interval with periodic status updates
                    wait_seconds = self.interval_minutes * 60
                    logger.info(f"⏰ Waiting {self.interval_minutes} minutes until next check (next: {self._next_run_time.strftime('%H:%M:%S')})")
                    
                    # Send status updates every 30 seconds during wait
                    elapsed = 0
                    update_interval = 30  # seconds
                    
                    while elapsed < wait_seconds:
                        try:
                            remaining_wait = min(update_interval, wait_seconds - elapsed)
                            await asyncio.wait_for(
                                self._stop_event.wait(),
                                timeout=remaining_wait
                            )
                            # If we get here, stop was requested
                            return
                        except asyncio.TimeoutError:
                            # Timeout is expected
                            elapsed += remaining_wait
                            
                            # Broadcast status update (for countdown)
                            if elapsed < wait_seconds:
                                await self._broadcast_status()
                
                first_run = False
                
                utc_now = datetime.now(pytz.UTC)
                
                # Determine which markets to check (comma-separated or single)
                if "," in self.market_type:
                    markets_to_check = [m.strip() for m in self.market_type.split(",")]
                else:
                    markets_to_check = [self.market_type]
                
                # Check and analyze each market (non-blocking)
                for market in markets_to_check:
                    if self._stop_event.is_set():
                        break
                    
                    # Get market local time
                    market_tz = self.market_timezones.get(market, pytz.UTC)
                    market_local_time = utc_now.astimezone(market_tz)
                    
                    # Check if market is open
                    is_open, status_msg = is_market_open(market, market_local_time)
                    if is_open:
                        # Check if there's already a running task for this market
                        existing_task = self._analysis_tasks.get(market)
                        if existing_task and not existing_task.done():
                            logger.warning(f"⏳ {market} analysis is still running from previous cycle")
                            logger.warning(f"   Skipping this cycle and will retry in next interval")
                            # Don't start a new task - let the existing one finish
                            # The next cycle will check again
                        else:
                            logger.info(f"✅ {market} market is open, triggering analysis: {status_msg}")
                            # Start analysis in background using ensure_future (more robust)
                            # This ensures the task runs independently without blocking the scheduler loop
                            task = asyncio.ensure_future(self._trigger_analysis(market))
                            self._analysis_tasks[market] = task
                            # Don't await - let it run in background
                    else:
                        logger.info(f"⏸️  {market} market is closed, skipping: {status_msg}")
                
                # Update next run time
                from datetime import timedelta
                self._next_run_time = datetime.now() + timedelta(minutes=self.interval_minutes)
                
                # Broadcast status update via WebSocket
                await self._broadcast_status()
            
            except Exception as e:
                logger.error(f"❌ Error in IntradayScheduler loop: {e}", exc_info=True)
                # Wait a bit before retrying to avoid tight error loop
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=60)
                    break
                except asyncio.TimeoutError:
                    continue
        
        logger.info("IntradayScheduler loop ended")
    
    async def _trigger_analysis(self, market: str):
        """
        Trigger intraday trading analysis for a specific market.
        This runs in the background and can be cancelled.
        
        Uses asyncio.to_thread() to run the potentially blocking analysis
        in a separate thread, preventing it from blocking the event loop.
        
        Args:
            market: Market to analyze (US/HK/CN)
        """
        try:
            logger.info(f"🚀 Triggering intraday trading analysis for {market} market (user {self.user_id})...")
            
            # Send WebSocket notification that analysis is starting
            try:
                from web.backend.app import manager as ws_manager
                from datetime import datetime
                
                channel_id = f"intraday_user_{self.user_id}"
                await ws_manager.send_message({
                    'type': 'analysis_trigger',
                    'timestamp': datetime.utcnow().isoformat(),
                    'message': f'开始 {market} 市场分析...',
                    'market_type': market,
                }, channel_id)
            except Exception as ws_error:
                logger.warning(f"Failed to send analysis trigger notification: {ws_error}")
            
            # Import here to avoid circular dependencies
            from web.backend.services.intraday_executor import execute_intraday_analysis
            
            # Run the analysis in a separate thread to avoid blocking the event loop
            # This is important because execute_intraday_analysis contains:
            # 1. Synchronous database operations (SessionLocal)
            # 2. Synchronous LLM calls (trader_agent.invoke)
            # 3. Potentially long-running operations
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,  # Use default ThreadPoolExecutor
                self._run_analysis_sync,
                market
            )
            
            logger.info(f"✅ {market} analysis completed: {result.get('status', 'unknown')}")
            
            # Create account snapshot after successful analysis
            # This is done here (in the main event loop) to avoid event loop conflicts
            if result.get('status') == 'success':
                try:
                    from web.backend.services.snapshot_scheduler import create_account_snapshot
                    
                    snapshot_created = await create_account_snapshot(
                        self.user_id, 
                        market, 
                        skip_market_check=True
                    )
                    if snapshot_created:
                        logger.info(f"✅ Account snapshot created for user {self.user_id} in {market} market")
                    else:
                        logger.warning(f"⚠️ Failed to create account snapshot for user {self.user_id} in {market} market")
                except Exception as snapshot_error:
                    logger.error(f"❌ Error creating account snapshot: {snapshot_error}", exc_info=True)
            
        except asyncio.CancelledError:
            logger.info(f"🛑 {market} analysis was cancelled")
            raise  # Re-raise to properly handle cancellation
        except Exception as e:
            logger.error(f"❌ Error triggering {market} analysis: {str(e)}", exc_info=True)
        finally:
            # Clean up task reference
            if market in self._analysis_tasks:
                del self._analysis_tasks[market]
    
    def _run_analysis_sync(self, market: str) -> dict:
        """
        Synchronous wrapper for execute_intraday_analysis.
        This runs in a thread pool to avoid blocking the event loop.
        
        Args:
            market: Market to analyze (US/HK/CN)
            
        Returns:
            dict: Analysis result
        """
        import asyncio
        from web.backend.services.intraday_executor import execute_intraday_analysis
        
        # Create a new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Run the async function in this thread's event loop
            result = loop.run_until_complete(
                execute_intraday_analysis(
                    market_type=market,
                    user_id=self.user_id,
                )
            )
            return result
        finally:
            loop.close()
    
    async def _broadcast_status(self):
        """Broadcast current status via WebSocket"""
        if self.user_id is None:
            return
        
        try:
            from web.backend.app import manager as ws_manager
            
            status = self.get_status()
            channel_id = f"intraday_user_{self.user_id}"
            
            await ws_manager.send_message({
                'type': 'scheduler_status_update',
                'timestamp': status.get('current_time'),
                'status': status,
            }, channel_id)
            
        except Exception as e:
            logger.debug(f"Failed to broadcast status: {e}")
    
    def get_status(self) -> dict:
        """Get current scheduler status with all markets info"""
        utc_now = datetime.now(pytz.UTC)
        
        # Get status for configured markets
        markets_status = {}
        if "," in self.market_type:
            markets_to_check = [m.strip() for m in self.market_type.split(",")]
        else:
            markets_to_check = [self.market_type]
        
        for market in markets_to_check:
            market_tz = self.market_timezones.get(market, pytz.UTC)
            market_local_time = utc_now.astimezone(market_tz)
            is_open, status_msg = is_market_open(market, market_local_time)
            
            # Check if there's a running task for this market
            task_running = False
            existing_task = self._analysis_tasks.get(market)
            if existing_task and not existing_task.done():
                task_running = True
            
            markets_status[market] = {
                "is_open": is_open,
                "status": status_msg,
                "local_time": market_local_time.strftime("%Y-%m-%d %H:%M:%S %Z"),
                "task_running": task_running
            }
        
        # Use tracked next run time
        next_run = None
        if self.is_running and self._next_run_time:
            next_run = self._next_run_time.isoformat()
        
        # Overall market status message
        if len(markets_to_check) > 1:
            # Multiple markets
            open_markets = [m for m, s in markets_status.items() if s["is_open"]]
            if open_markets:
                market_status = f"Markets open: {', '.join(open_markets)}"
                market_is_open = True
            else:
                market_status = "All markets closed"
                market_is_open = False
        else:
            # Single market
            single_market = markets_to_check[0]
            market_status = markets_status[single_market]["status"]
            market_is_open = markets_status[single_market]["is_open"]
        
        return {
            "is_running": self.is_running,
            "interval_minutes": self.interval_minutes,
            "market_type": self.market_type,
            "market_status": market_status,
            "market_is_open": market_is_open,
            "markets_status": markets_status,  # Detailed status for each market
            "next_run_time": next_run,
            "current_time": datetime.now().isoformat(),
        }
    
    def update_interval(self, interval_minutes: int):
        """Update analysis interval"""
        if interval_minutes < 5 or interval_minutes > 120:
            raise ValueError("Interval must be between 5 and 120 minutes")
        
        self.interval_minutes = interval_minutes
        logger.info(f"IntradayScheduler interval updated to {interval_minutes} minutes")


# NOTE: This file only contains the IntradayScheduler class definition.
# For multi-user scheduler management, use user_intraday_scheduler.py
# 
# The global singleton pattern has been removed in favor of per-user scheduler instances.
# Each user gets their own IntradayScheduler instance managed by UserIntradaySchedulerManager.


import os
