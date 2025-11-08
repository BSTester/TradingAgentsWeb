"""
Futu Trading Tools
LangChain tool wrappers for Futu mock trading API functions.
"""

from langchain_core.tools import tool, InjectedToolArg
from langchain_core.runnables import RunnableConfig
from typing import Annotated, Optional
from tradingagents.dataflows.futu_trading import (
    get_account_info as _get_account_info,
    get_positions as _get_positions,
    get_quote as _get_quote,
    place_order as _place_order,
    cancel_order as _cancel_order,
    get_orders as _get_orders,
    get_kline_data as _get_kline_data,
    get_hot_stocks as _get_hot_stocks,
    get_hot_news as _get_hot_news,
    get_technical_analysis as _get_technical_analysis
)
import json


@tool
def get_futu_account_info(
    market_type: Annotated[str, "Market type: US, HK, or CN"]
) -> str:
    """
    Get account information for a specific market from Futu mock trading account.
    
    Returns account balance, cash, position value, and profit/loss information.
    Use this before placing orders to verify sufficient funds.
    
    Args:
        market_type: Market type (US/HK/CN)
        
    Returns:
        str: JSON formatted account information including net asset value, cash, 
             position value, and profit/loss
    
    Example:
        >>> account = get_futu_account_info("US")
    """
    try:
        result = _get_account_info(market_type)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error getting account info: {str(e)}"


@tool
def get_futu_positions(
    market_type: Annotated[str, "Market type: US, HK, or CN"],
    config: Annotated[RunnableConfig, InjectedToolArg] = None
) -> str:
    """
    Get all current positions for a specific market from Futu mock trading account.
    
    Returns list of holdings with quantity, cost, current value, and P&L.
    Use this before selling to verify available shares.
    
    Args:
        market_type: Market type (US/HK/CN)
        
    Returns:
        str: JSON formatted list of positions with stock code, quantity, 
             cost price, current price, profit/loss, holding days, and first open time
    
    Example:
        >>> positions = get_futu_positions("US")
    """
    try:
        # Extract user_id from config if available
        user_id = None
        if config and "configurable" in config:
            user_id = config["configurable"].get("user_id")
        
        result = _get_positions(market_type, user_id=user_id)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error getting positions: {str(e)}"


@tool
def get_futu_quote(
    stock_code: Annotated[str, "Stock symbol (e.g., AAPL, 00700, 600519)"]
) -> str:
    """
    Get real-time quote for a specific stock from Futu (auto-detects market type).
    
    Market detection rules:
    - 5-digit numbers (e.g., 00700) → HK stock
    - 6-digit numbers (e.g., 600519) → A stock
    - Contains letters (e.g., AAPL) → US stock
    
    Returns current price, OHLC, volume, and other market data.
    Use this to get current market price before placing orders.
    
    Args:
        stock_code: Stock symbol
        
    Returns:
        str: JSON formatted quote data with current price, open, high, low,
             volume, and change information
    
    Example:
        >>> quote = get_futu_quote("AAPL")
    """
    try:
        result = _get_quote(stock_code)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error getting quote for {stock_code}: {str(e)}"


@tool
def place_futu_order(
    stock_code: Annotated[str, "Stock symbol"],
    side: Annotated[str, "Order side: BUY or SELL"],
    quantity: Annotated[int, "Number of shares"],
    price: Annotated[Optional[float], "Limit price (required for LIMIT orders)"] = None,
    order_type: Annotated[str, "Order type: LIMIT or MARKET"] = "LIMIT"
) -> str:
    """
    Place a buy or sell order in Futu mock trading account (auto-detects market type).
    
    Market detection rules:
    - 5-digit numbers (e.g., 00700) → HK stock
    - 6-digit numbers (e.g., 600519, 688xxx) → A stock
    - Contains letters (e.g., AAPL) → US stock
    
    For LIMIT orders, specify the price. For MARKET orders, price is optional.
    Returns order ID if successful, error message if failed.
    
    Args:
        stock_code: Stock symbol (e.g., AAPL, 00700, 600519)
        side: Order side (BUY/SELL)
        quantity: Number of shares
        price: Limit price (required for LIMIT orders)
        order_type: Order type (LIMIT/MARKET), defaults to LIMIT
        
    Returns:
        str: JSON formatted order response with success status, message, and order_id
    
    Example:
        >>> # Place limit buy order
        >>> result = place_futu_order("AAPL", "BUY", 10, price=180.50)
        
        >>> # Place market sell order
        >>> result = place_futu_order("AAPL", "SELL", 10, order_type="MARKET")
    """
    try:
        result = _place_order(
            stock_code=stock_code,
            side=side,
            quantity=quantity,
            price=price,
            order_type=order_type
        )
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error placing order: {str(e)}"


@tool
def cancel_futu_order(
    order_id: Annotated[str, "Order ID to cancel"],
    stock_code: Annotated[str, "Stock code for auto-detecting market type"]
) -> str:
    """
    Cancel a pending order in Futu mock trading account (auto-detects market type).
    
    Market detection rules:
    - 5-digit numbers (e.g., 00700) → HK stock
    - 6-digit numbers (e.g., 600519) → A stock
    - Contains letters (e.g., AAPL) → US stock
    
    Only pending orders can be cancelled. Filled or already cancelled orders cannot be cancelled.
    
    Args:
        order_id: Order ID to cancel
        stock_code: Stock code (used for auto-detecting market type)
        
    Returns:
        str: JSON formatted cancellation response with success status and message
    
    Example:
        >>> result = cancel_futu_order("123456789", "AAPL")
    """
    try:
        result = _cancel_order(order_id, stock_code)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error cancelling order: {str(e)}"


@tool
def get_futu_orders(
    market_type: Annotated[str, "Market type: US, HK, or CN"],
    filter_status: Annotated[int, "Filter by status: 0=all, 1=filled, 2=pending, 3=cancelled"] = 0
) -> str:
    """
    Query order history and status from Futu mock trading account.
    
    Returns list of orders with their current status, filled quantity, and timestamps.
    Use this to verify order execution after placing orders.
    
    Args:
        market_type: Market type (US/HK/CN)
        filter_status: Filter by status (0=all, 1=filled, 2=pending, 3=cancelled)
        
    Returns:
        str: JSON formatted list of orders with order_id, stock_code, side, quantity,
             price, status, and timestamps
    
    Example:
        >>> # Get all orders
        >>> orders = get_futu_orders("US")
        
        >>> # Get only filled orders
        >>> filled = get_futu_orders("US", filter_status=1)
    """
    try:
        result = _get_orders(market_type, filter_status)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error getting orders: {str(e)}"


@tool
def get_futu_kline(
    symbol: Annotated[str, "Stock symbol"],
    interval: Annotated[str, "Time interval: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly"] = "daily",
    start_date: Annotated[Optional[str], "Start date in YYYY-MM-DD format (date only, no time component)"] = None,
    end_date: Annotated[Optional[str], "End date in YYYY-MM-DD format (date only, no time component)"] = None,
    format: Annotated[str, "Return format: json or csv"] = "csv"
) -> str:
    """
    Get K-line (candlestick) data for a stock from Futu (auto-detects market type).
    
    Market detection rules:
    - 5-digit numbers (e.g., 00700) → HK stock
    - 6-digit numbers (e.g., 600519) → A stock
    - Contains letters (e.g., AAPL) → US stock
    
    Returns historical OHLCV data with timestamps in market local time.
    Useful for analyzing price trends before making trading decisions.
    
    Timezone handling:
    - US stocks: Eastern Time (EST/EDT, UTC-5/-4, auto-handles DST)
    - HK stocks: Hong Kong Time (HKT, UTC+8)
    - A stocks: China Standard Time (CST, UTC+8)
    
    Return formats:
    - csv (default): CSV format with meta information and data string
    - json: Structured JSON data with list of K-line records
    
    Data range recommendations:
    - For intervals < weekly (1min, 5min, 15min, 30min, 60min, daily): Fetch last 1 month
    - For weekly and above: Can fetch longer historical data
    
    Args:
        symbol: Stock symbol
        interval: Time interval (1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly)
        start_date: Start date (YYYY-MM-DD format only, e.g., "2025-10-04")
        end_date: End date (YYYY-MM-DD format only, e.g., "2025-11-03")
        format: Return format (json or csv), defaults to csv
        
    Returns:
        str: JSON formatted K-line data
            For csv format (default): Dict with 'meta', 'data' (CSV string), and 'format' fields
            For json format: List of K-line records with timestamp, open, high, low, close, volume
    
    Example:
        >>> # Get daily K-line for last month in CSV format (default)
        >>> klines_csv = get_futu_kline("AAPL", interval="daily", start_date="2025-10-04", end_date="2025-11-03")
        
        >>> # Get 5-minute intraday data in JSON format
        >>> klines_json = get_futu_kline("AAPL", interval="5min", start_date="2025-10-04", end_date="2025-11-03", format="json")
        
        >>> # Get weekly data (can use longer range)
        >>> klines_weekly = get_futu_kline("AAPL", interval="weekly", start_date="2025-01-01", end_date="2025-11-03")
    """
    try:
        result = _get_kline_data(symbol, interval, start_date, end_date, format)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error getting K-line data: {str(e)}"


@tool
def get_futu_hot_stocks(
    market_type: Annotated[str, "Market type: US, HK, or CN"] = "US",
    count: Annotated[int, "Number of stocks to return"] = 10
) -> str:
    """
    Get list of hot/trending stocks from Futu.
    
    Returns top trending stocks with current price and change percentage.
    Useful for discovering trading opportunities.
    
    Args:
        market_type: Market type (US/HK/CN), defaults to US
        count: Number of stocks to return, defaults to 10
        
    Returns:
        str: JSON formatted list of hot stocks with stock_code, name, price, and change_pct
    
    Example:
        >>> hot_stocks = get_futu_hot_stocks("US", count=5)
    """
    try:
        result = _get_hot_stocks(market_type, count)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error getting hot stocks: {str(e)}"


@tool
def get_futu_hot_news(
    lang: Annotated[str, "Language code: zh-cn, zh-hk, or en-us"] = "zh-cn"
) -> str:
    """
    Get hot/trending news articles from Futu.
    
    Returns list of recent news with titles, sources, and publication times.
    Useful for understanding market sentiment and news-driven opportunities.
    
    Args:
        lang: Language code (zh-cn/zh-hk/en-us), defaults to zh-cn
        
    Returns:
        str: JSON formatted list of news articles with title, url, source, and publish_time
    
    Example:
        >>> news = get_futu_hot_news("zh-cn")
    """
    try:
        result = _get_hot_news(lang)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error getting hot news: {str(e)}"


@tool
def get_futu_technical_analysis(
    symbol: Annotated[str, "Stock symbol"],
    interval: Annotated[str, "Time interval: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly"] = "daily",
    indicator: Annotated[str, "Technical indicator: close_50_sma, close_200_sma, close_10_ema, macd, rsi, boll, atr, vwma"] = "macd",
    start_date: Annotated[Optional[str], "Start date in YYYY-MM-DD format (date only, no time component)"] = None,
    end_date: Annotated[Optional[str], "End date in YYYY-MM-DD format (date only, no time component)"] = None,
    format: Annotated[str, "Return format: json or csv"] = "csv"
) -> str:
    """
    Get technical analysis indicators from Futu (returns time series data, auto-detects market type).
    
    Market detection rules:
    - 5-digit numbers (e.g., 00700) → HK stock
    - 6-digit numbers (e.g., 600519) → A stock
    - Contains letters (e.g., AAPL) → US stock
    
    Available indicators:
    - close_50_sma: 50-period Simple Moving Average
    - close_200_sma: 200-period Simple Moving Average
    - close_10_ema: 10-period Exponential Moving Average
    - macd: MACD (returns MACD, MACD_Signal, MACD_Hist)
    - rsi: Relative Strength Index
    - boll: Bollinger Bands (returns Boll_Upper, Boll_Middle, Boll_Lower)
    - atr: Average True Range
    - vwma: Volume Weighted Moving Average
    
    Return formats:
    - csv (default): CSV format with meta information and data string
    - json: Structured JSON data suitable for plotting charts
    
    Data range recommendations:
    - For intervals < weekly (1min, 5min, 15min, 30min, 60min, daily): Fetch last 1 month
    - For weekly and above: Can fetch longer historical data
    - Date range should match the K-line data range
    
    Returns time series data suitable for plotting charts and technical analysis.
    Use this to analyze price trends and momentum before making trading decisions.
    
    Args:
        symbol: Stock symbol
        interval: Time interval (1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly)
        indicator: Technical indicator name
        start_date: Start date (YYYY-MM-DD format only, e.g., "2025-10-04")
        end_date: End date (YYYY-MM-DD format only, e.g., "2025-11-03")
        format: Return format (json or csv), defaults to csv
        
    Returns:
        str: JSON formatted technical analysis data with time series values
            For csv format, returns dict with 'meta', 'data' (CSV string), and 'format' fields
    
    Example:
        >>> # Get MACD indicator for last month in CSV format (default)
        >>> macd_csv = get_futu_technical_analysis("AAPL", interval="daily", indicator="macd", 
        ...                                         start_date="2025-10-04", end_date="2025-11-03")
        
        >>> # Get RSI in JSON format
        >>> rsi_json = get_futu_technical_analysis("AAPL", interval="5min", indicator="rsi", 
        ...                                         start_date="2025-10-04", end_date="2025-11-03", format="json")
        
        >>> # Get Bollinger Bands
        >>> boll = get_futu_technical_analysis("AAPL", interval="60min", indicator="boll",
        ...                                     start_date="2025-10-04", end_date="2025-11-03")
    """
    try:
        result = _get_technical_analysis(symbol, interval, indicator, start_date, end_date, format)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return f"Error getting technical analysis: {str(e)}"
