#!/usr/bin/env python3
"""
Futu API Client

Async wrapper for tradingagents.dataflows.futu_trading module.
Converts synchronous Futu API calls to async for use in FastAPI.
"""

import asyncio
import logging
import os
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)


class FutuAPIClient:
    """Async wrapper for Futu API calls"""
    
    def __init__(self, base_url: str, timeout: float = 30.0):
        """
        Initialize Futu API client
        
        Args:
            base_url: Base URL of Futu OpenD API (e.g., http://localhost:11111)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        
        # Set environment variable for futu_trading module to use
        os.environ['FUTU_API_BASE_URL'] = self.base_url
    
    async def get_account_info(self, market_type: str) -> Optional[Dict[str, Any]]:
        """
        Get account information for a specific market
        
        Args:
            market_type: Market type (US, HK, CN)
            
        Returns:
            Account info dict or None if error
        """
        try:
            from tradingagents.dataflows.futu_trading import get_account_info
            
            # Run sync function in thread pool to avoid blocking
            result = await asyncio.to_thread(get_account_info, market_type)
            return result
        
        except Exception as e:
            logger.error(f"Error getting account info: {e}")
            return None
    
    async def get_positions(self, market_type: str, user_id: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """
        Get positions for a specific market
        
        Args:
            market_type: Market type (US, HK, CN)
            user_id: User ID for enriching with database info (optional)
            
        Returns:
            List of position dicts or None if error
        """
        try:
            from tradingagents.dataflows.futu_trading import get_positions
            
            # Run sync function in thread pool to avoid blocking
            result = await asyncio.to_thread(get_positions, market_type, user_id)
            return result
        
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return None
    
    async def get_orders(self, market_type: str, filter_status: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """
        Get orders for a specific market
        
        Args:
            market_type: Market type (US, HK, CN)
            filter_status: Filter by order status (optional)
            
        Returns:
            List of order dicts or None if error
        """
        try:
            from tradingagents.dataflows.futu_trading import get_orders
            
            # Run sync function in thread pool to avoid blocking
            if filter_status is not None:
                result = await asyncio.to_thread(get_orders, market_type, filter_status)
            else:
                result = await asyncio.to_thread(get_orders, market_type)
            return result
        
        except Exception as e:
            logger.error(f"Error getting orders: {e}")
            return None
