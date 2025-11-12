#!/usr/bin/env python3
"""
Futu API Client

Simple HTTP client for interacting with Futu OpenD API.
"""

import httpx
import logging
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)


class FutuAPIClient:
    """HTTP client for Futu OpenD API"""
    
    def __init__(self, base_url: str, timeout: float = 30.0):
        """
        Initialize Futu API client
        
        Args:
            base_url: Base URL of Futu OpenD API (e.g., http://localhost:11111)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
    
    async def get_account_info(self, market_type: str) -> Optional[Dict[str, Any]]:
        """
        Get account information for a specific market
        
        Args:
            market_type: Market type (US, HK, CN)
            
        Returns:
            Account info dict or None if error
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/account/info",
                    params={"market": market_type}
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get("success"):
                    return data.get("data", {})
                else:
                    logger.error(f"Futu API error: {data.get('message')}")
                    return None
        
        except httpx.HTTPError as e:
            logger.error(f"HTTP error getting account info: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting account info: {e}")
            return None
    
    async def get_positions(self, market_type: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get positions for a specific market
        
        Args:
            market_type: Market type (US, HK, CN)
            
        Returns:
            List of position dicts or None if error
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/positions",
                    params={"market": market_type}
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get("success"):
                    return data.get("data", [])
                else:
                    logger.error(f"Futu API error: {data.get('message')}")
                    return None
        
        except httpx.HTTPError as e:
            logger.error(f"HTTP error getting positions: {e}")
            return None
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
            params = {"market": market_type}
            if filter_status is not None:
                params["status"] = filter_status
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/orders",
                    params=params
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get("success"):
                    return data.get("data", [])
                else:
                    logger.error(f"Futu API error: {data.get('message')}")
                    return None
        
        except httpx.HTTPError as e:
            logger.error(f"HTTP error getting orders: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting orders: {e}")
            return None
