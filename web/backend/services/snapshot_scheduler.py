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
            from web.backend.services.futu_async_wrapper import get_account_info_async
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
                        
                        # Get account info for the market (user_id will be used to fetch user-specific config)
                        account_info = await get_account_info_async(market_type, user_id=user.id)
                        if not account_info:
                            logger.warning(f"No account info for user {user.id} in {market_type} market")
                            continue
                        
                        # Extract account data - use correct field names from Futu API response
                        # API returns: net_asset, cash, market_value, profit_loss, today_profit_loss
                        total_assets = account_info.get("net_asset", 0.0)
                        cash = account_info.get("cash", 0.0)
                        market_value = account_info.get("market_value", 0.0)
                        
                        # Use profit_loss from API (total unrealized P&L)
                        # Use today_profit_loss as realized P&L for the day
                        unrealized_pnl = account_info.get("profit_loss", 0.0)
                        realized_pnl = account_info.get("today_profit_loss", 0.0)
                        
                        # Get market timezone and current local time
                        market_tz_map = {
                            'US': 'America/New_York',
                            'HK': 'Asia/Hong_Kong',
                            'CN': 'Asia/Shanghai'
                        }
                        market_tz = pytz.timezone(market_tz_map.get(market_type, 'UTC'))
                        local_now = datetime.now(market_tz)
                        
                        # Create snapshot with market local time (naive datetime for SQLite)
                        # SQLite doesn't preserve timezone, so we store as naive datetime in local time
                        snapshot = AccountSnapshot(
                            user_id=user.id,
                            market_type=market_type,
                            snapshot_date=local_now.replace(tzinfo=None),  # Store as naive datetime in local time
                            total_assets=total_assets,
                            cash=cash,
                            market_value=market_value,
                            realized_pnl=realized_pnl,
                            unrealized_pnl=unrealized_pnl,
                            account_data=None  # No need to store currency, frontend determines it
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



# Standalone function to create snapshot for a specific user and market
async def create_account_snapshot(user_id: int, market_type: str, skip_market_check: bool = False) -> bool:
    """
    Create an account snapshot for a specific user and market.
    
    This function can be called from anywhere (e.g., after intraday trading analysis).
    
    Args:
        user_id: User ID
        market_type: Market type (US, HK, CN)
        skip_market_check: If True, create snapshot regardless of market status (default: False)
                          Set to True when called after intraday analysis completion
        
    Returns:
        bool: True if snapshot created successfully, False otherwise
    """
    try:
        from web.backend.database import AsyncSessionLocal
        from web.backend.models import User, UserConfig, AccountSnapshot
        from web.backend.services.futu_async_wrapper import get_account_info_async
        from sqlalchemy import select
        from tradingagents.agents.utils.market_utils import is_market_open
        
        # Get market timezone and current time
        market_tz_map = {
            'US': 'America/New_York',
            'HK': 'Asia/Hong_Kong',
            'CN': 'Asia/Shanghai'
        }
        market_tz_name = market_tz_map.get(market_type.upper(), 'UTC')
        market_tz = pytz.timezone(market_tz_name)
        market_now = datetime.now(market_tz)
        
        # Check if market is open (unless skip_market_check is True)
        if not skip_market_check:
            is_open, status_msg = is_market_open(market_type, market_now)
            if not is_open:
                logger.info(f"Market {market_type} is closed, skipping snapshot: {status_msg}")
                return False
        
        async with AsyncSessionLocal() as db:
            # Get user
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                logger.warning(f"User {user_id} not found")
                return False
            
            # Check if user has access
            if user.role != 'admin' and not user.can_access_intraday_trading:
                logger.warning(f"User {user_id} does not have intraday trading access")
                return False
            
            # Get user config
            result = await db.execute(
                select(UserConfig).where(UserConfig.user_id == user_id)
            )
            user_config = result.scalar_one_or_none()
            
            if not user_config or not (user_config.intraday_futu_api_url or user_config.futu_api_base_url):
                logger.warning(f"User {user_id} does not have Futu API configured")
                return False
            
            # Get account info
            account_info = await get_account_info_async(market_type, user_id=user_id)
            if not account_info:
                logger.warning(f"No account info for user {user_id} in {market_type} market")
                return False
            
            # Extract account data
            total_assets = account_info.get("net_asset", 0.0)
            cash = account_info.get("cash", 0.0)
            market_value = account_info.get("market_value", 0.0)
            unrealized_pnl = account_info.get("profit_loss", 0.0)
            realized_pnl = account_info.get("today_profit_loss", 0.0)
            
            # Get market local time
            local_now = datetime.now(market_tz)
            # Round to nearest second to avoid microsecond differences
            snapshot_date_naive = local_now.replace(tzinfo=None, microsecond=0)
            
            # Check if a snapshot already exists at this exact time (same second)
            # This allows multiple snapshots per day at different times
            from sqlalchemy import and_
            
            existing_query = select(AccountSnapshot).where(
                and_(
                    AccountSnapshot.user_id == user_id,
                    AccountSnapshot.market_type == market_type.upper(),
                    AccountSnapshot.snapshot_date == snapshot_date_naive
                )
            )
            
            existing_result = await db.execute(existing_query)
            existing_snapshot = existing_result.scalar_one_or_none()
            
            if existing_snapshot:
                # Update existing snapshot at this exact time
                existing_snapshot.total_assets = total_assets
                existing_snapshot.cash = cash
                existing_snapshot.market_value = market_value
                existing_snapshot.realized_pnl = realized_pnl
                existing_snapshot.unrealized_pnl = unrealized_pnl
                existing_snapshot.account_data = None
                
                await db.commit()
                logger.info(f"✅ Updated existing snapshot for user {user_id} in {market_type} market at {snapshot_date_naive} (ID: {existing_snapshot.id})")
                return True
            else:
                # Create new snapshot with market local time (naive datetime for SQLite)
                # SQLite doesn't preserve timezone, so we store as naive datetime in local time
                snapshot = AccountSnapshot(
                    user_id=user_id,
                    market_type=market_type.upper(),
                    snapshot_date=snapshot_date_naive,  # Store as naive datetime in local time (no microseconds)
                    total_assets=total_assets,
                    cash=cash,
                    market_value=market_value,
                    realized_pnl=realized_pnl,
                    unrealized_pnl=unrealized_pnl,
                    account_data=None
                )
                
                db.add(snapshot)
                await db.commit()
                
                logger.info(f"✅ Created new snapshot for user {user_id} in {market_type} market at {snapshot_date_naive}")
                return True
            
    except Exception as e:
        logger.error(f"Error creating snapshot for user {user_id}: {e}")
        return False
