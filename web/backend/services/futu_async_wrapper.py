#!/usr/bin/env python3
"""
Futu API Async Wrapper

Provides async wrappers for tradingagents.dataflows.futu_trading module.
Converts synchronous Futu API calls to async for use in FastAPI.
"""

import asyncio
import logging
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)


async def get_account_info_async(
    market_type: str,
    user_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Async wrapper for get_account_info
    
    Args:
        market_type: Market type (US, HK, CN)
        user_id: User ID for user-specific configuration
        
    Returns:
        Account info dict or None if error
    """
    try:
        from tradingagents.dataflows.futu_trading import get_account_info
        
        # Run sync function in thread pool to avoid blocking
        result = await asyncio.to_thread(get_account_info, market_type, user_id)
        return result
    
    except Exception as e:
        logger.error(f"Error getting account info: {e}")
        return None


async def get_positions_async(
    market_type: str,
    user_id: Optional[int] = None
) -> Optional[List[Dict[str, Any]]]:
    """
    Async wrapper for get_positions
    
    Args:
        market_type: Market type (US, HK, CN)
        user_id: User ID for enriching with database info and user-specific configuration
        
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


async def get_orders_async(
    market_type: str,
    filter_status: int = 0,
    user_id: Optional[int] = None
) -> Optional[List[Dict[str, Any]]]:
    """
    Async wrapper for get_orders
    
    Args:
        market_type: Market type (US, HK, CN)
        filter_status: Filter by order status (0=all, 1=filled, 2=pending, 3=cancelled)
        user_id: User ID for user-specific configuration
        
    Returns:
        List of order dicts or None if error
    """
    try:
        from tradingagents.dataflows.futu_trading import get_orders
        
        # Run sync function in thread pool to avoid blocking
        result = await asyncio.to_thread(get_orders, market_type, filter_status, user_id)
        return result
    
    except Exception as e:
        logger.error(f"Error getting orders: {e}")
        return None


async def get_quote_async(
    stock_code: str,
    user_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Async wrapper for get_quote
    
    Args:
        stock_code: Stock symbol
        user_id: User ID for user-specific configuration
        
    Returns:
        Quote dict or None if error
    """
    try:
        from tradingagents.dataflows.futu_trading import get_quote
        
        result = await asyncio.to_thread(get_quote, stock_code, user_id)
        return result
    
    except Exception as e:
        logger.error(f"Error getting quote: {e}")
        return None


async def get_kline_data_async(
    symbol: str,
    interval: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "csv",
    user_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Async wrapper for get_kline_data
    
    Args:
        symbol: Stock symbol
        interval: Time interval
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        format: Return format (json or csv)
        user_id: User ID for user-specific configuration
        
    Returns:
        K-line data or None if error
    """
    try:
        from tradingagents.dataflows.futu_trading import get_kline_data
        
        result = await asyncio.to_thread(
            get_kline_data, symbol, interval, start_date, end_date, format, user_id
        )
        return result
    
    except Exception as e:
        logger.error(f"Error getting kline data: {e}")
        return None


async def get_hot_stocks_async(
    market_type: str = "US",
    count: int = 10,
    user_id: Optional[int] = None
) -> Optional[List[Dict[str, Any]]]:
    """
    Async wrapper for get_hot_stocks
    
    Args:
        market_type: Market type (US, HK, CN)
        count: Number of stocks to return
        user_id: User ID for user-specific configuration
        
    Returns:
        List of hot stock dicts or None if error
    """
    try:
        from tradingagents.dataflows.futu_trading import get_hot_stocks
        
        result = await asyncio.to_thread(get_hot_stocks, market_type, count, user_id)
        return result
    
    except Exception as e:
        logger.error(f"Error getting hot stocks: {e}")
        return None


async def place_order_async(
    stock_code: str,
    side: str,
    quantity: int,
    price: Optional[float] = None,
    order_type: str = "LIMIT",
    user_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Async wrapper for place_order
    
    Args:
        stock_code: Stock symbol
        side: Order side (BUY/SELL)
        quantity: Number of shares
        price: Limit price
        order_type: Order type (LIMIT/MARKET)
        user_id: User ID for user-specific configuration
        
    Returns:
        Order response dict or None if error
    """
    try:
        from tradingagents.dataflows.futu_trading import place_order
        
        result = await asyncio.to_thread(
            place_order, stock_code, side, quantity, price, order_type, user_id
        )
        return result
    
    except Exception as e:
        logger.error(f"Error placing order: {e}")
        return None


async def cancel_order_async(
    order_id: str,
    stock_code: str,
    user_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Async wrapper for cancel_order
    
    Args:
        order_id: Order ID to cancel
        stock_code: Stock code
        user_id: User ID for user-specific configuration
        
    Returns:
        Cancellation response dict or None if error
    """
    try:
        from tradingagents.dataflows.futu_trading import cancel_order
        
        result = await asyncio.to_thread(cancel_order, order_id, stock_code, user_id)
        return result
    
    except Exception as e:
        logger.error(f"Error cancelling order: {e}")
        return None


async def get_technical_analysis_async(
    symbol: str,
    interval: str = "daily",
    indicator: str = "macd",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "csv",
    user_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Async wrapper for get_technical_analysis
    
    Args:
        symbol: Stock symbol
        interval: Time interval
        indicator: Technical indicator name
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        format: Return format (json or csv)
        user_id: User ID for user-specific configuration
        
    Returns:
        Technical analysis data or None if error
    """
    try:
        from tradingagents.dataflows.futu_trading import get_technical_analysis
        
        result = await asyncio.to_thread(
            get_technical_analysis, symbol, interval, indicator, 
            start_date, end_date, format, user_id
        )
        return result
    
    except Exception as e:
        logger.error(f"Error getting technical analysis: {e}")
        return None


async def get_hot_news_async(
    lang: str = "zh-cn",
    user_id: Optional[int] = None
) -> Optional[List[Dict[str, Any]]]:
    """
    Async wrapper for get_hot_news
    
    Args:
        lang: Language code (zh-cn/zh-hk/en-us)
        user_id: User ID for user-specific configuration
        
    Returns:
        List of news article dicts or None if error
    """
    try:
        from tradingagents.dataflows.futu_trading import get_hot_news
        
        result = await asyncio.to_thread(get_hot_news, lang, user_id)
        return result
    
    except Exception as e:
        logger.error(f"Error getting hot news: {e}")
        return None
