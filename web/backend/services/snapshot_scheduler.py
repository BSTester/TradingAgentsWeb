#!/usr/bin/env python3
"""
Asset Snapshot Scheduler Service

Automatically creates daily account snapshots at market close times.
Supports multiple markets (US, HK, CN) with different close times.
Handles timezone conversions and daylight saving time automatically.
"""

import logging
from datetime import datetime, time
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.job import Job
import pytz

logger = logging.getLogger(__name__)


class SnapshotScheduler:
    """Scheduler for automatic daily account snapshots"""
    
    # Market close times in their local timezones
    # APScheduler will automatically handle DST conversions
    MARKET_CLOSE_TIMES = {
        'US': {
            'hour': 16,           # 4:00 PM Eastern Time
            'minute': 0,
            'timezone': 'America/New_York',  # Handles EDT/EST automatically
            'description': '美东时间 16:00 (自动处理夏令时/冬令时)'
        },
        'HK': {
            'hour': 16,           # 4:00 PM Hong Kong Time
            'minute': 0,
            'timezone': 'Asia/Hong_Kong',
            'description': '香港时间 16:00'
        },
        'CN': {
            'hour': 15,           # 3:00 PM China Standard Time
            'minute': 0,
            'timezone': 'Asia/Shanghai',
            'description': '北京时间 15:00'
        },
    }
    
    def __init__(self):
        """Initialize snapshot scheduler"""
        # Use UTC as base timezone, individual jobs will use their market timezones
        self.scheduler = AsyncIOScheduler(timezone='UTC')
        self._started = False
        logger.info("SnapshotScheduler initialized")
    
    def start(self):
        """Start the scheduler and register snapshot jobs"""
        if not self._started:
            # Register snapshot jobs for each market
            for market_type, close_time in self.MARKET_CLOSE_TIMES.items():
                self._register_snapshot_job(market_type, close_time)
            
            self.scheduler.start()
            self._started = True
            logger.info("✅ Snapshot scheduler started")
            self._print_scheduled_jobs()
    
    def shutdown(self, wait: bool = True):
        """
        Shutdown the scheduler
        
        Args:
            wait: Whether to wait for running jobs to complete
        """
        if self._started:
            self.scheduler.shutdown(wait=wait)
            self._started = False
            logger.info("✅ Snapshot scheduler stopped")
    
    def _register_snapshot_job(self, market_type: str, close_time: dict):
        """
        Register a daily snapshot job for a market
        
        Args:
            market_type: Market type (US, HK, CN)
            close_time: Dict with 'hour', 'minute', 'timezone', and 'description' keys
        """
        job_id = f"snapshot_{market_type.lower()}"
        
        # Create cron trigger for daily execution at market close
        # Using market's local timezone - APScheduler handles DST automatically
        trigger = CronTrigger(
            hour=close_time['hour'],
            minute=close_time['minute'],
            timezone=close_time['timezone']  # Use market's local timezone
        )
        
        # Add job to scheduler
        job = self.scheduler.add_job(
            func=self._create_snapshots_for_market,
            trigger=trigger,
            args=[market_type],
            id=job_id,
            name=f"Daily {market_type} Market Snapshot",
            replace_existing=True
        )
        
        # Get next run time in both local and Beijing time for logging
        try:
            next_run = getattr(job, 'next_run_time', None)
            if next_run:
                beijing_tz = pytz.timezone('Asia/Shanghai')
                next_run_beijing = next_run.astimezone(beijing_tz)
                
                logger.info(
                    f"Registered snapshot job for {market_type} market: "
                    f"{close_time['description']}"
                )
                logger.info(
                    f"  Next run: {next_run_beijing.strftime('%Y-%m-%d %H:%M:%S %Z')} "
                    f"(Beijing time)"
                )
            else:
                logger.info(
                    f"Registered snapshot job for {market_type} market: "
                    f"{close_time['description']}"
                )
        except Exception as e:
            logger.warning(f"Could not get next run time: {e}")
            logger.info(
                f"Registered snapshot job for {market_type} market: "
                f"{close_time['description']}"
            )
    
    async def _create_snapshots_for_market(self, market_type: str):
        """
        Create snapshots for all users with positions in the specified market
        
        Args:
            market_type: Market type (US, HK, CN)
        """
        try:
            logger.info(f"Creating {market_type} market snapshots...")
            
            from web.backend.database import AsyncSessionLocal
            from web.backend.models import User, UserConfig, AccountSnapshot
            from web.backend.services.futu_api_client import FutuAPIClient
            from sqlalchemy import select
            from datetime import datetime
            
            async with AsyncSessionLocal() as db:
                # Get all users with Futu API configured
                result = await db.execute(
                    select(User, UserConfig)
                    .join(UserConfig, User.id == UserConfig.user_id)
                    .where(UserConfig.futu_api_base_url.isnot(None))
                )
                users_with_config = result.all()
                
                snapshot_count = 0
                error_count = 0
                
                for user, config in users_with_config:
                    try:
                        # Skip if user doesn't have intraday trading access
                        if user.role != 'admin' and not user.can_access_intraday_trading:
                            continue
                        
                        # Get Futu API URL
                        futu_api_url = config.intraday_futu_api_url or config.futu_api_base_url
                        if not futu_api_url:
                            continue
                        
                        # Create API client
                        client = FutuAPIClient(base_url=futu_api_url)
                        
                        # Get account info for the market
                        account_info = await client.get_account_info(market_type)
                        if not account_info:
                            logger.warning(f"No account info for user {user.id} in {market_type} market")
                            continue
                        
                        # Get positions for the market (pass user_id for database enrichment)
                        positions = await client.get_positions(market_type, user_id=user.id)
                        
                        # Calculate totals - map field names from futu_trading.py API
                        total_assets = account_info.get("net_asset_value", 0.0)
                        cash = account_info.get("cash", 0.0)
                        market_value = account_info.get("position_value", 0.0)
                        
                        # Calculate P&L from positions
                        realized_pnl = 0.0
                        unrealized_pnl = 0.0
                        if positions:
                            for pos in positions:
                                # Use profit_loss from position as unrealized P&L
                                unrealized_pnl += pos.get("profit_loss", 0.0)
                        
                        # Check if snapshot already exists for today (using market local date)
                        # Get market timezone
                        market_tz_name = self.MARKET_CLOSE_TIMES[market_type]['timezone']
                        market_tz = pytz.timezone(market_tz_name)
                        
                        # Get current date in market timezone
                        market_now = datetime.now(market_tz)
                        market_today = market_now.date()
                        
                        # Convert to datetime range for query (in UTC)
                        market_day_start = market_tz.localize(datetime.combine(market_today, time.min))
                        market_day_end = market_tz.localize(datetime.combine(market_today, time.max))
                        
                        # Query for existing snapshot on this market date
                        existing = await db.execute(
                            select(AccountSnapshot)
                            .where(
                                AccountSnapshot.user_id == user.id,
                                AccountSnapshot.market_type == market_type,
                                AccountSnapshot.snapshot_date >= market_day_start,
                                AccountSnapshot.snapshot_date <= market_day_end
                            )
                        )
                        existing_snapshot = existing.scalar_one_or_none()
                        
                        if existing_snapshot:
                            logger.info(
                                f"Snapshot already exists for user {user.id} in {market_type} market "
                                f"on {market_today} (market local date)"
                            )
                            continue
                        
                        # Create snapshot
                        snapshot = AccountSnapshot(
                            user_id=user.id,
                            market_type=market_type,
                            snapshot_date=datetime.now(),
                            total_assets=total_assets,
                            cash=cash,
                            market_value=market_value,
                            realized_pnl=realized_pnl,
                            unrealized_pnl=unrealized_pnl,
                        )
                        
                        db.add(snapshot)
                        await db.commit()
                        
                        snapshot_count += 1
                        logger.info(
                            f"Created snapshot for user {user.id} ({user.username}) "
                            f"in {market_type} market: ${total_assets:.2f}"
                        )
                    
                    except Exception as e:
                        error_count += 1
                        logger.error(
                            f"Error creating snapshot for user {user.id} in {market_type} market: {e}",
                            exc_info=True
                        )
                        continue
                
                logger.info(
                    f"✅ {market_type} market snapshot job completed: "
                    f"{snapshot_count} created, {error_count} errors"
                )
        
        except Exception as e:
            logger.error(f"Error in snapshot job for {market_type} market: {e}", exc_info=True)
    
    def get_job(self, market_type: str) -> Optional[Job]:
        """
        Get snapshot job for a market
        
        Args:
            market_type: Market type (US, HK, CN)
            
        Returns:
            Job object or None if not found
        """
        job_id = f"snapshot_{market_type.lower()}"
        return self.scheduler.get_job(job_id)
    
    def get_next_run_time(self, market_type: str) -> Optional[datetime]:
        """
        Get next run time for a market's snapshot job
        
        Args:
            market_type: Market type (US, HK, CN)
            
        Returns:
            Next run time or None if not found
        """
        job = self.get_job(market_type)
        if job:
            try:
                return getattr(job, 'next_run_time', None)
            except Exception:
                return None
        return None
    
    def _print_scheduled_jobs(self):
        """Print all scheduled snapshot jobs with timezone information"""
        jobs = self.scheduler.get_jobs()
        if not jobs:
            logger.info("No snapshot jobs scheduled")
            return
        
        beijing_tz = pytz.timezone('Asia/Shanghai')
        logger.info(f"📸 Scheduled snapshot jobs ({len(jobs)}):")
        for job in jobs:
            try:
                next_run = getattr(job, 'next_run_time', None)
                if next_run:
                    # Show time in both original timezone and Beijing time
                    next_run_beijing = next_run.astimezone(beijing_tz)
                    logger.info(
                        f"  - {job.name}:\n"
                        f"    Next run: {next_run.strftime('%Y-%m-%d %H:%M:%S %Z')}\n"
                        f"    Beijing:  {next_run_beijing.strftime('%Y-%m-%d %H:%M:%S %Z')}"
                    )
                else:
                    logger.info(f"  - {job.name}: Scheduled (next run time not available)")
            except Exception as e:
                logger.warning(f"  - {job.name}: Could not get next run time ({e})")


# Global scheduler instance
_snapshot_scheduler: Optional[SnapshotScheduler] = None


def get_snapshot_scheduler() -> SnapshotScheduler:
    """Get or create global snapshot scheduler instance"""
    global _snapshot_scheduler
    if _snapshot_scheduler is None:
        _snapshot_scheduler = SnapshotScheduler()
    return _snapshot_scheduler


def init_snapshot_scheduler() -> SnapshotScheduler:
    """Initialize and start the snapshot scheduler"""
    scheduler = get_snapshot_scheduler()
    if not scheduler._started:
        scheduler.start()
    return scheduler
