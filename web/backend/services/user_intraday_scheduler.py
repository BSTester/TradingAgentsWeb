#!/usr/bin/env python3
"""
User-level Intraday Trading Scheduler Manager

This module manages multiple IntradayScheduler instances, one per user.
It provides a centralized way to create, start, stop, and configure
user-specific intraday trading schedulers.

Architecture:
    UserIntradaySchedulerManager (this file)
        └── Manages multiple IntradayScheduler instances
            └── Each IntradayScheduler (intraday_scheduler.py)
                └── Calls IntradayExecutor (intraday_executor.py)
                    └── Executes LangGraph agent (intraday_trader.py)

Usage:
    from web.backend.services.user_intraday_scheduler import get_manager
    
    manager = get_manager()
    
    # Create and start a scheduler for a user
    scheduler = await manager.create_scheduler(
        user_id=1,
        interval_minutes=5,
        market_type="US"
    )
    await manager.start_scheduler(user_id=1)
    
    # Stop a scheduler
    await manager.stop_scheduler(user_id=1)
"""

import asyncio
import logging
from typing import Dict, Optional
from web.backend.services.intraday_scheduler import IntradayScheduler

# Get logger for this module
logger = logging.getLogger(__name__)


class UserIntradaySchedulerManager:
    """
    Manages intraday trading schedulers for multiple users.
    Each user has their own scheduler instance with their own configuration.
    """
    
    def __init__(self):
        self._schedulers: Dict[int, IntradayScheduler] = {}
        self._user_configs: Dict[int, dict] = {}
        logger.info("UserIntradaySchedulerManager initialized")
    
    def get_scheduler(self, user_id: int) -> Optional[IntradayScheduler]:
        """Get scheduler for a specific user"""
        return self._schedulers.get(user_id)
    
    def has_scheduler(self, user_id: int) -> bool:
        """Check if user has a scheduler"""
        return user_id in self._schedulers
    
    async def create_scheduler(
        self,
        user_id: int,
        interval_minutes: int = 5,
        market_type: str = "US,HK,CN",
        futu_api_url: str = None,
    ) -> IntradayScheduler:
        """
        Create a new scheduler for a user.
        
        Args:
            user_id: User ID
            interval_minutes: Analysis interval in minutes
            market_type: Market type. Single market (US/HK/CN) or comma-separated (US,HK,CN)
            futu_api_url: Futu API base URL for this user
            
        Returns:
            IntradayScheduler instance
        """
        # Stop existing scheduler if any
        if user_id in self._schedulers:
            await self.stop_scheduler(user_id)
        
        # Create new scheduler
        scheduler = IntradayScheduler(
            interval_minutes=interval_minutes,
            market_type=market_type,
            user_id=user_id,
        )
        
        self._schedulers[user_id] = scheduler
        self._user_configs[user_id] = {
            'futu_api_url': futu_api_url,
            'interval_minutes': interval_minutes,
            'market_type': market_type,
        }
        
        logger.info(f"Created scheduler for user {user_id}: interval={interval_minutes}min, market={market_type}")
        return scheduler
    
    async def start_scheduler(self, user_id: int) -> bool:
        """
        Start scheduler for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            True if started successfully, False otherwise
        """
        scheduler = self._schedulers.get(user_id)
        if not scheduler:
            logger.error(f"No scheduler found for user {user_id}")
            return False
        
        if scheduler.is_running:
            logger.warning(f"Scheduler for user {user_id} is already running")
            return True
        
        await scheduler.start()
        logger.info(f"Started scheduler for user {user_id}")
        return True
    
    async def stop_scheduler(self, user_id: int) -> bool:
        """
        Stop scheduler for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            True if stopped successfully, False otherwise
        """
        scheduler = self._schedulers.get(user_id)
        if not scheduler:
            logger.warning(f"No scheduler found for user {user_id}")
            return False
        
        if not scheduler.is_running:
            logger.warning(f"Scheduler for user {user_id} is not running")
            return True
        
        await scheduler.stop()
        logger.info(f"Stopped scheduler for user {user_id}")
        return True
    
    async def remove_scheduler(self, user_id: int) -> bool:
        """
        Remove scheduler for a user (stop and delete).
        
        Args:
            user_id: User ID
            
        Returns:
            True if removed successfully, False otherwise
        """
        if user_id in self._schedulers:
            await self.stop_scheduler(user_id)
            del self._schedulers[user_id]
            if user_id in self._user_configs:
                del self._user_configs[user_id]
            logger.info(f"Removed scheduler for user {user_id}")
            return True
        return False
    
    def get_scheduler_status(self, user_id: int) -> Optional[dict]:
        """
        Get scheduler status for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Status dict or None if scheduler doesn't exist
        """
        scheduler = self._schedulers.get(user_id)
        if not scheduler:
            return None
        
        status = scheduler.get_status()
        # Add user-specific config
        if user_id in self._user_configs:
            status['futu_api_url'] = self._user_configs[user_id].get('futu_api_url')
        
        return status
    
    def update_scheduler_config(
        self,
        user_id: int,
        interval_minutes: Optional[int] = None,
        market_type: Optional[str] = None,
        futu_api_url: Optional[str] = None,
    ) -> bool:
        """
        Update scheduler configuration for a user.
        
        Args:
            user_id: User ID
            interval_minutes: New interval (optional)
            market_type: New market type (optional)
            futu_api_url: New Futu API URL (optional)
            
        Returns:
            True if updated successfully, False otherwise
        """
        scheduler = self._schedulers.get(user_id)
        if not scheduler:
            logger.error(f"No scheduler found for user {user_id}")
            return False
        
        # Update interval
        if interval_minutes is not None:
            scheduler.update_interval(interval_minutes)
            if user_id in self._user_configs:
                self._user_configs[user_id]['interval_minutes'] = interval_minutes
        
        # Update market type
        if market_type is not None:
            scheduler.market_type = market_type
            if user_id in self._user_configs:
                self._user_configs[user_id]['market_type'] = market_type
        
        # Update Futu API URL
        if futu_api_url is not None:
            if user_id in self._user_configs:
                self._user_configs[user_id]['futu_api_url'] = futu_api_url
        
        logger.info(f"Updated scheduler config for user {user_id}")
        return True
    
    def get_user_config(self, user_id: int) -> Optional[dict]:
        """Get user-specific configuration"""
        return self._user_configs.get(user_id)
    
    async def stop_all_schedulers(self):
        """Stop all schedulers (for shutdown)"""
        logger.info("Stopping all user schedulers...")
        for user_id in list(self._schedulers.keys()):
            await self.stop_scheduler(user_id)
        logger.info("All user schedulers stopped")
    
    def get_active_users(self) -> list:
        """Get list of user IDs with active schedulers"""
        return [
            user_id for user_id, scheduler in self._schedulers.items()
            if scheduler.is_running
        ]
    
    def get_all_users(self) -> list:
        """Get list of all user IDs with schedulers"""
        return list(self._schedulers.keys())


# Global manager instance
_manager_instance: Optional[UserIntradaySchedulerManager] = None


def get_manager() -> UserIntradaySchedulerManager:
    """Get or create global manager instance"""
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = UserIntradaySchedulerManager()
    return _manager_instance
