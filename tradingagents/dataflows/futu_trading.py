"""
Futu Mock Trading API Integration
Provides functions to interact with Futu's mock trading API for account management,
market data retrieval, and trade execution across US, HK, and CN markets.
"""

import logging
import time
from typing import Annotated, Optional, Dict, List, Any
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger("tradingagents.futu_trading")


class FutuAPIError(Exception):
    """Custom exception for Futu API errors"""
    
    def __init__(self, message: str, error_type: str = "api", error_code: str = None, 
                 details: Dict = None, retry_able: bool = False):
        super().__init__(message)
        self.error_type = error_type
        self.error_code = error_code
        self.details = details or {}
        self.retry_able = retry_able


def _get_base_url() -> str:
    """
    Get configured Futu API base URL from config.
    
    Returns:
        str: Base URL for Futu API
    """
    try:
        from .config import get_config
        config = get_config()
        base_url = config.get("futu_api_base_url", "http://localhost:9000")
        logger.debug(f"Using Futu API base URL: {base_url}")
        return base_url
    except Exception as e:
        logger.warning(f"Failed to get config, using default base URL: {e}")
        return "http://localhost:9000"


def _get_timeout() -> int:
    """
    Get configured API timeout from config.
    
    Returns:
        int: Timeout in seconds
    """
    try:
        from .config import get_config
        config = get_config()
        timeout = config.get("futu_api_timeout", 30)
        return timeout
    except Exception as e:
        logger.warning(f"Failed to get timeout config, using default: {e}")
        return 30


def _get_api_key() -> Optional[str]:
    """
    Get Futu API key from environment variable or config.
    
    Returns:
        str: API key or None if not configured
    """
    import os
    
    # Try environment variable first
    api_key = os.getenv("FUTU_API_KEY")
    if api_key:
        logger.debug("Using Futu API key from environment variable")
        return api_key
    
    # Try config as fallback
    try:
        from .config import get_config
        config = get_config()
        api_key = config.get("futu_api_key")
        if api_key:
            logger.debug("Using Futu API key from config")
            return api_key
    except Exception as e:
        logger.debug(f"Failed to get API key from config: {e}")
    
    logger.warning("No Futu API key configured - requests may fail if authentication is required")
    return None


def _create_session() -> requests.Session:
    """
    Create a requests session with retry logic and connection pooling.
    
    Returns:
        requests.Session: Configured session object
    """
    session = requests.Session()
    
    # Configure retry strategy
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"]
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    return session


# Global session for connection pooling
_session = _create_session()


def _make_request(
    method: str,
    endpoint: str,
    params: Optional[Dict] = None,
    json_data: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Make HTTP request to Futu API with error handling and retry logic.
    
    Args:
        method: HTTP method (GET/POST)
        endpoint: API endpoint path (e.g., "/api/account")
        params: Query parameters for GET requests
        json_data: JSON body for POST requests
        
    Returns:
        dict: Parsed JSON response
        
    Raises:
        FutuAPIError: If request fails or returns error
    """
    base_url = _get_base_url()
    timeout = _get_timeout()
    api_key = _get_api_key()
    url = f"{base_url}{endpoint}"
    
    # Prepare headers
    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key
        logger.debug("Added X-API-Key header to request")
    
    logger.debug(f"Making {method} request to {url}")
    logger.debug(f"Params: {params}, JSON: {json_data}")
    
    start_time = time.time()
    
    try:
        if method.upper() == "GET":
            response = _session.get(url, params=params, headers=headers, timeout=timeout)
        elif method.upper() == "POST":
            response = _session.post(url, json=json_data, headers=headers, timeout=timeout)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        elapsed_time = time.time() - start_time
        logger.info(f"{method} {endpoint} completed in {elapsed_time:.2f}s with status {response.status_code}")
        
        # Check for HTTP errors
        if response.status_code == 401 or response.status_code == 403:
            raise FutuAPIError(
                "Authentication failed - Cookie may have expired",
                error_type="auth",
                error_code=str(response.status_code),
                retry_able=False
            )
        
        if response.status_code >= 500:
            raise FutuAPIError(
                f"Server error: {response.status_code}",
                error_type="api",
                error_code=str(response.status_code),
                details={"response": response.text},
                retry_able=True
            )
        
        if response.status_code >= 400:
            raise FutuAPIError(
                f"Client error: {response.status_code}",
                error_type="api",
                error_code=str(response.status_code),
                details={"response": response.text},
                retry_able=False
            )
        
        # Parse JSON response
        try:
            data = response.json()
            logger.debug(f"Response data: {data}")
            return data
        except ValueError as e:
            raise FutuAPIError(
                f"Failed to parse JSON response: {e}",
                error_type="api",
                details={"response": response.text},
                retry_able=False
            )
    
    except requests.exceptions.Timeout:
        logger.error(f"Request timeout after {timeout}s")
        raise FutuAPIError(
            f"Request timeout after {timeout} seconds",
            error_type="network",
            retry_able=True
        )
    
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error: {e}")
        raise FutuAPIError(
            f"Failed to connect to Futu API: {e}",
            error_type="network",
            retry_able=True
        )
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Request failed: {e}")
        raise FutuAPIError(
            f"Request failed: {e}",
            error_type="network",
            details={"exception": str(e)},
            retry_able=True
        )



def get_account_info(
    market_type: Annotated[str, "Market type: US, HK, or CN"]
) -> Dict[str, Any]:
    """
    Get account information for a specific market.
    
    Args:
        market_type: Market type (US/HK/CN)
        
    Returns:
        dict: Account details including:
            - net_asset_value: Total account value
            - cash: Available cash
            - position_value: Total position market value
            - profit_loss: Total P&L
            - profit_loss_pct: P&L percentage
            
    Raises:
        FutuAPIError: If API call fails or authentication error occurs
        ValueError: If market_type is invalid
        
    Example:
        >>> account = get_account_info("US")
        >>> print(f"Cash: {account['cash']}")
    """
    # Validate market type
    if market_type.upper() not in ["US", "HK", "CN"]:
        raise ValueError(f"Invalid market_type: {market_type}. Must be US, HK, or CN")
    
    logger.info(f"Fetching account info for market: {market_type}")
    
    try:
        response = _make_request(
            method="GET",
            endpoint="/api/account",
            params={"market_type": market_type}
        )
        
        logger.info(f"Successfully retrieved account info for {market_type}")
        return response
        
    except FutuAPIError as e:
        if e.error_type == "auth":
            logger.error(f"Authentication error getting account info: {e}")
            raise FutuAPIError(
                "Failed to get account info - Cookie may have expired. Please re-authenticate.",
                error_type="auth",
                error_code=e.error_code,
                retry_able=False
            )
        raise


def get_positions(
    market_type: Annotated[str, "Market type: US, HK, or CN"],
    user_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Get all positions for a specific market.
    
    Queries Futu API for current positions and enriches with database information
    including first open time and holding days.
    
    Args:
        market_type: Market type (US/HK/CN)
        
    Returns:
        list: List of position dictionaries, each containing:
            - stock_code: Stock symbol
            - stock_name: Stock name
            - quantity: Total shares held
            - available_quantity: Shares available for trading
            - cost_price: Average cost per share
            - current_price: Current market price
            - market_value: Total position value
            - profit_loss: Unrealized P&L
            - profit_loss_pct: P&L percentage
            - first_open_time: First open time from database (if available)
            - holding_days: Days since first open (if available)
            
    Raises:
        FutuAPIError: If API call fails
        ValueError: If market_type is invalid
        
    Example:
        >>> positions = get_positions("US")
        >>> for pos in positions:
        ...     print(f"{pos['stock_code']}: {pos['quantity']} shares, held {pos.get('holding_days', 0)} days")
    """
    # Validate market type
    if market_type.upper() not in ["US", "HK", "CN"]:
        raise ValueError(f"Invalid market_type: {market_type}. Must be US, HK, or CN")
    
    logger.info(f"Fetching positions for market: {market_type}")
    
    try:
        response = _make_request(
            method="GET",
            endpoint="/api/positions",
            params={"market_type": market_type}
        )
        
        # Handle different response formats
        if isinstance(response, list):
            positions = response
        elif isinstance(response, dict) and "positions" in response:
            positions = response["positions"]
        elif isinstance(response, dict) and "data" in response:
            positions = response["data"]
        else:
            positions = []
        
        # Try to enrich with database information (first open time)
        # user_id should be passed as parameter from the tool
        if user_id:
            try:
                from web.backend.database import SessionLocal
                from web.backend.models import PositionRecord
                from datetime import datetime, date
                
                db = SessionLocal()
                try:
                    # Query position records for this user and market
                    records = db.query(PositionRecord).filter(
                        PositionRecord.user_id == user_id,
                        PositionRecord.market_type == market_type,
                        PositionRecord.is_closed == False
                    ).all()
                    
                    # Create lookup dict
                    records_dict = {rec.stock_code: rec for rec in records}
                    
                    # Get today's date for calculating holding days
                    today = date.today()
                    
                    # Enrich positions with database info
                    for pos in positions:
                        stock_code = pos.get('stock_code', '')
                        if stock_code in records_dict:
                            record = records_dict[stock_code]
                            pos['first_open_time'] = record.first_open_time.isoformat() if record.first_open_time else None
                            if record.first_open_time:
                                # Convert to date only (ignore time component)
                                open_date = record.first_open_time.date() if hasattr(record.first_open_time, 'date') else record.first_open_time
                                pos['holding_days'] = (today - open_date).days
                            else:
                                pos['holding_days'] = 0
                        else:
                            pos['first_open_time'] = None
                            pos['holding_days'] = 0
                    
                    logger.info(f"Enriched {len(positions)} positions with database info for user {user_id}")
                finally:
                    db.close()
            except Exception as e:
                # If enrichment fails, just log and continue with basic position data
                logger.warning(f"Failed to enrich positions with database info: {e}")
                for pos in positions:
                    pos['first_open_time'] = None
                    pos['holding_days'] = 0
        else:
            # No user_id provided, add empty fields
            for pos in positions:
                pos['first_open_time'] = None
                pos['holding_days'] = 0
        
        logger.info(f"Successfully retrieved {len(positions)} positions for {market_type}")
        return positions
        
    except FutuAPIError as e:
        if e.error_type == "auth":
            logger.error(f"Authentication error getting positions: {e}")
            raise FutuAPIError(
                "Failed to get positions - Cookie may have expired. Please re-authenticate.",
                error_type="auth",
                error_code=e.error_code,
                retry_able=False
            )
        raise



def get_quote(
    stock_code: Annotated[str, "Stock symbol (e.g., AAPL, 00700, 600519)"]
) -> Dict[str, Any]:
    """
    Get real-time quote for a specific stock (auto-detects market type).
    
    Market detection rules:
    - 5-digit numbers (e.g., 00700) → HK stock
    - 6-digit numbers (e.g., 600519) → A stock
    - Contains letters (e.g., AAPL) → US stock
    
    Args:
        stock_code: Stock symbol (e.g., AAPL, 00700, 600519)
        
    Returns:
        dict: Real-time quote data with fields:
            - stock_code: Stock symbol
            - stock_name: Stock name
            - current_price: Current market price
            - open_price: Opening price (optional, only when available)
            - high_price: Day's high (optional, only when available)
            - low_price: Day's low (optional, only when available)
            - previous_close: Previous close price
            - volume: Trading volume (optional, only when available)
            - change: Price change
            - change_pct: Percentage change
            - timestamp: Quote timestamp
            
    Raises:
        FutuAPIError: If API call fails or stock not found
        ValueError: If parameters are invalid
        
    Example:
        >>> quote = get_quote("AAPL")
        >>> print(f"Current price: {quote['current_price']}")
    """
    # Validate inputs
    if not stock_code:
        raise ValueError("stock_code cannot be empty")
    
    logger.info(f"Fetching quote for {stock_code} (auto-detecting market)")
    
    try:
        response = _make_request(
            method="GET",
            endpoint="/api/quote",
            params={"stock_code": stock_code}
        )
        
        logger.info(f"Successfully retrieved quote for {stock_code}")
        return response
        
    except FutuAPIError as e:
        logger.error(f"Failed to get quote for {stock_code}: {e}")
        raise


def get_kline_data(
    symbol: Annotated[str, "Stock symbol"],
    interval: Annotated[str, "Time interval: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly"] = "daily",
    start_date: Annotated[Optional[str], "Start date in YYYY-MM-DD format (date only, no time component)"] = None,
    end_date: Annotated[Optional[str], "End date in YYYY-MM-DD format (date only, no time component)"] = None,
    format: Annotated[str, "Return format: json or csv"] = "csv"
) -> Dict[str, Any]:
    """
    Get K-line (candlestick) data for a stock (auto-detects market type).
    
    Market detection rules:
    - 5-digit numbers (e.g., 00700) → HK stock
    - 6-digit numbers (e.g., 600519) → A stock
    - Contains letters (e.g., AAPL) → US stock
    
    Timezone handling:
    - US stocks: Eastern Time (EST/EDT, UTC-5/-4, auto-handles DST)
    - HK stocks: Hong Kong Time (HKT, UTC+8)
    - A stocks: China Standard Time (CST, UTC+8)
    
    Return formats:
    - csv (default): CSV format with meta information and data string
    - json: Structured JSON data with list of K-line records
    
    Args:
        symbol: Stock symbol
        interval: Time interval (1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly)
        start_date: Start date (YYYY-MM-DD format only, e.g., "2025-10-04")
        end_date: End date (YYYY-MM-DD format only, e.g., "2025-11-03")
        format: Return format (json or csv), defaults to csv
        
    Returns:
        dict: K-line data in specified format
            - For csv format (default): Returns dict with 'meta', 'data' (CSV string), and 'format' fields
            - For json format: Returns list of K-line records, each containing:
                - timestamp: Time in market local timezone
                - open: Opening price
                - high: High price
                - low: Low price
                - close: Closing price
                - volume: Trading volume
            
    Raises:
        FutuAPIError: If API call fails
        ValueError: If parameters are invalid
        
    Example:
        >>> # Get daily K-line for last month in CSV format (default)
        >>> klines_csv = get_kline_data("AAPL", interval="daily", start_date="2025-10-04", end_date="2025-11-03")
        
        >>> # Get 5-minute intraday data in JSON format
        >>> klines_json = get_kline_data("AAPL", interval="5min", start_date="2025-10-04", end_date="2025-11-03", format="json")
        >>> for kline in klines_json[-5:]:
        ...     print(f"{kline['timestamp']}: Close={kline['close']}")
    """
    # Validate inputs
    if not symbol:
        raise ValueError("symbol cannot be empty")
    
    valid_intervals = ["1min", "5min", "15min", "30min", "60min", "daily", "weekly", "monthly", "quarterly", "yearly"]
    if interval.lower() not in valid_intervals:
        raise ValueError(f"Invalid interval: {interval}. Must be one of {valid_intervals}")
    
    valid_formats = ["json", "csv"]
    if format.lower() not in valid_formats:
        raise ValueError(f"Invalid format: {format}. Must be one of {valid_formats}")
    
    logger.info(f"Fetching K-line data for {symbol} with interval={interval}, start_date={start_date}, end_date={end_date}, format={format}")
    
    try:
        params = {
            "symbol": symbol,
            "interval": interval,
            "format": format
        }
        
        # Add optional date parameters if provided
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        
        response = _make_request(
            method="GET",
            endpoint="/api/kline",
            params=params
        )
        
        # For csv format, return response directly
        if format == "csv":
            logger.info(f"Successfully retrieved K-line data for {symbol} in CSV format")
            return response
        
        # For json format, handle different response structures
        if isinstance(response, list):
            klines = response
        elif isinstance(response, dict) and "klines" in response:
            klines = response["klines"]
        elif isinstance(response, dict) and "data" in response:
            klines = response["data"]
        else:
            klines = []
        
        logger.info(f"Successfully retrieved {len(klines)} K-line records for {symbol}")
        return klines
        
    except FutuAPIError as e:
        logger.error(f"Failed to get K-line data for {symbol}: {e}")
        raise


def get_hot_stocks(
    market_type: Annotated[str, "Market type: US, HK, or CN"] = "US",
    count: Annotated[int, "Number of stocks to return"] = 10
) -> List[Dict[str, Any]]:
    """
    Get list of hot/trending stocks.
    
    Args:
        market_type: Market type (US/HK/CN), defaults to US
        count: Number of stocks to return, defaults to 10
        
    Returns:
        list: List of hot stock information, each containing:
            - stock_code: Stock symbol
            - stock_name: Stock name
            - current_price: Current price
            - change_pct: Percentage change
            - volume: Trading volume
            - Other market-specific fields
            
    Raises:
        FutuAPIError: If API call fails
        ValueError: If parameters are invalid
        
    Example:
        >>> hot_stocks = get_hot_stocks("US", count=5)
        >>> for stock in hot_stocks:
        ...     print(f"{stock['stock_code']}: {stock['change_pct']}%")
    """
    # Validate inputs
    if market_type.upper() not in ["US", "HK", "CN"]:
        raise ValueError(f"Invalid market_type: {market_type}. Must be US, HK, or CN")
    if count <= 0:
        raise ValueError(f"count must be positive, got {count}")
    
    logger.info(f"Fetching top {count} hot stocks for {market_type} market")
    
    try:
        response = _make_request(
            method="GET",
            endpoint="/api/hot-stocks",
            params={
                "market_type": market_type,
                "count": count
            }
        )
        
        # Handle different response formats
        if isinstance(response, list):
            stocks = response
        elif isinstance(response, dict) and "stocks" in response:
            stocks = response["stocks"]
        elif isinstance(response, dict) and "data" in response:
            stocks = response["data"]
        else:
            stocks = []
        
        logger.info(f"Successfully retrieved {len(stocks)} hot stocks for {market_type}")
        return stocks
        
    except FutuAPIError as e:
        logger.error(f"Failed to get hot stocks for {market_type}: {e}")
        raise



def place_order(
    stock_code: Annotated[str, "Stock symbol"],
    side: Annotated[str, "Order side: BUY or SELL"],
    quantity: Annotated[int, "Number of shares"],
    price: Annotated[Optional[float], "Limit price (required for LIMIT orders)"] = None,
    order_type: Annotated[str, "Order type: LIMIT or MARKET"] = "LIMIT"
) -> Dict[str, Any]:
    """
    Place a buy or sell order (auto-detects market type from stock code).
    
    Market detection rules:
    - 5-digit numbers (e.g., 00700) → HK stock
    - 6-digit numbers (e.g., 600519, 688xxx) → A stock
    - Contains letters (e.g., AAPL) → US stock
    
    Args:
        stock_code: Stock symbol (e.g., AAPL, 00700, 600519)
        side: Order side (BUY/SELL)
        quantity: Number of shares
        price: Limit price (required for LIMIT orders, optional for MARKET orders)
        order_type: Order type (LIMIT/MARKET), defaults to LIMIT
        
    Returns:
        dict: Order response with:
            - success: True if order placed successfully
            - message: Human-readable message
            - order_id: Order ID for tracking (null if failed)
            - data: Additional details (null if failed)
            
    Raises:
        FutuAPIError: If order placement fails
        ValueError: If required parameters are missing or invalid
        
    Example:
        >>> # Place a limit buy order
        >>> result = place_order("AAPL", "BUY", 10, price=180.50)
        >>> if result['success']:
        ...     print(f"Order placed: {result['order_id']}")
        
        >>> # Place a market sell order
        >>> result = place_order("AAPL", "SELL", 10, order_type="MARKET")
    """
    # Validate inputs
    if not stock_code:
        raise ValueError("stock_code cannot be empty")
    if side.upper() not in ["BUY", "SELL"]:
        raise ValueError(f"Invalid side: {side}. Must be BUY or SELL")
    if quantity <= 0:
        raise ValueError(f"quantity must be positive, got {quantity}")
    if order_type.upper() not in ["LIMIT", "MARKET"]:
        raise ValueError(f"Invalid order_type: {order_type}. Must be LIMIT or MARKET")
    
    # For LIMIT orders, price is required
    if order_type.upper() == "LIMIT" and price is None:
        raise ValueError("price is required for LIMIT orders")
    
    logger.info(f"Placing {order_type} {side} order: {quantity} shares of {stock_code} at {price}")
    
    # Build request payload
    order_data = {
        "stock_code": stock_code,
        "side": side,
        "quantity": quantity,
        "order_type": order_type
    }
    
    if price is not None:
        order_data["price"] = price
    
    try:
        response = _make_request(
            method="POST",
            endpoint="/api/trade",
            json_data=order_data
        )
        
        if response.get("success"):
            logger.info(f"Order placed successfully: {response.get('order_id')}")
        else:
            logger.warning(f"Order placement failed: {response.get('message')}")
        
        return response
        
    except FutuAPIError as e:
        logger.error(f"Failed to place order for {stock_code}: {e}")
        raise


def cancel_order(
    order_id: Annotated[str, "Order ID to cancel"],
    stock_code: Annotated[str, "Stock code for auto-detecting market type"]
) -> Dict[str, Any]:
    """
    Cancel a pending order (auto-detects market type from stock code).
    
    Market detection rules:
    - 5-digit numbers (e.g., 00700) → HK stock
    - 6-digit numbers (e.g., 600519) → A stock
    - Contains letters (e.g., AAPL) → US stock
    
    Args:
        order_id: Order ID to cancel
        stock_code: Stock code (used for auto-detecting market type)
        
    Returns:
        dict: Cancellation response with:
            - success: True if order cancelled successfully
            - message: Human-readable message
            - order_id: Cancelled order ID
            - data: Additional details
            
    Raises:
        FutuAPIError: If cancellation fails
        ValueError: If parameters are invalid
        
    Example:
        >>> result = cancel_order("123456789", "AAPL")
        >>> if result['success']:
        ...     print("Order cancelled successfully")
    """
    # Validate inputs
    if not order_id:
        raise ValueError("order_id cannot be empty")
    if not stock_code:
        raise ValueError("stock_code cannot be empty")
    
    logger.info(f"Cancelling order {order_id} for {stock_code}")
    
    try:
        response = _make_request(
            method="POST",
            endpoint="/api/cancel",
            json_data={
                "order_id": order_id,
                "stock_code": stock_code
            }
        )
        
        if response.get("success"):
            logger.info(f"Order {order_id} cancelled successfully")
        else:
            logger.warning(f"Order cancellation failed: {response.get('message')}")
        
        return response
        
    except FutuAPIError as e:
        logger.error(f"Failed to cancel order {order_id}: {e}")
        raise


def get_orders(
    market_type: Annotated[str, "Market type: US, HK, or CN"],
    filter_status: Annotated[int, "Filter by status: 0=all, 1=filled, 2=pending, 3=cancelled"] = 0
) -> List[Dict[str, Any]]:
    """
    Query order history and status.
    
    Args:
        market_type: Market type (US/HK/CN)
        filter_status: Filter by status (0=all, 1=filled, 2=pending, 3=cancelled)
        
    Returns:
        list: List of orders with status and details. Each order contains:
            - order_id: Order ID
            - stock_code: Stock symbol
            - side: BUY or SELL
            - quantity: Number of shares
            - price: Order price
            - order_type: LIMIT or MARKET
            - status: Order status
            - filled_quantity: Shares filled
            - create_time: Order creation time
            - update_time: Last update time
            
    Raises:
        FutuAPIError: If query fails
        ValueError: If parameters are invalid
        
    Example:
        >>> # Get all orders
        >>> orders = get_orders("US")
        
        >>> # Get only filled orders
        >>> filled_orders = get_orders("US", filter_status=1)
        >>> for order in filled_orders:
        ...     print(f"{order['order_id']}: {order['stock_code']}")
    """
    # Validate inputs
    if market_type.upper() not in ["US", "HK", "CN"]:
        raise ValueError(f"Invalid market_type: {market_type}. Must be US, HK, or CN")
    if filter_status not in [0, 1, 2, 3]:
        raise ValueError(f"Invalid filter_status: {filter_status}. Must be 0, 1, 2, or 3")
    
    status_names = {0: "all", 1: "filled", 2: "pending", 3: "cancelled"}
    logger.info(f"Fetching {status_names[filter_status]} orders for {market_type} market")
    
    try:
        response = _make_request(
            method="GET",
            endpoint="/api/orders",
            params={
                "market_type": market_type,
                "filter_status": filter_status
            }
        )
        
        # Handle different response formats
        if isinstance(response, list):
            orders = response
        elif isinstance(response, dict) and "orders" in response:
            orders = response["orders"]
        elif isinstance(response, dict) and "data" in response:
            orders = response["data"]
        else:
            orders = []
        
        logger.info(f"Successfully retrieved {len(orders)} orders for {market_type}")
        return orders
        
    except FutuAPIError as e:
        logger.error(f"Failed to get orders for {market_type}: {e}")
        raise



def get_technical_analysis(
    symbol: Annotated[str, "Stock symbol"],
    interval: Annotated[str, "Time interval: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly"] = "daily",
    indicator: Annotated[str, "Technical indicator: close_50_sma, close_200_sma, close_10_ema, macd, rsi, boll, atr, vwma"] = "macd",
    start_date: Annotated[Optional[str], "Start date in YYYY-MM-DD format (date only, no time component)"] = None,
    end_date: Annotated[Optional[str], "End date in YYYY-MM-DD format (date only, no time component)"] = None,
    format: Annotated[str, "Return format: json or csv"] = "csv"
) -> Dict[str, Any]:
    """
    Get technical analysis indicators (returns time series data, auto-detects market type).
    
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
    
    Args:
        symbol: Stock symbol
        interval: Time interval (1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly)
        indicator: Technical indicator name
        start_date: Start date (YYYY-MM-DD format only, e.g., "2025-10-04")
        end_date: End date (YYYY-MM-DD format only, e.g., "2025-11-03")
        format: Return format (json or csv), defaults to csv
        
    Returns:
        dict: Technical analysis data with time series values
            - For csv format (default): Returns dict with 'meta', 'data' (CSV string), and 'format' fields
            - For json format: Returns structured data suitable for plotting charts
        
    Raises:
        FutuAPIError: If API call fails
        ValueError: If parameters are invalid
        
    Example:
        >>> # Get MACD indicator for last month in CSV format (default)
        >>> macd_csv = get_technical_analysis("AAPL", interval="daily", indicator="macd",
        ...                                    start_date="2025-10-04", end_date="2025-11-03")
        
        >>> # Get RSI in JSON format
        >>> rsi_json = get_technical_analysis("AAPL", interval="5min", indicator="rsi",
        ...                                    start_date="2025-10-04", end_date="2025-11-03", format="json")
        
        >>> # Get Bollinger Bands
        >>> boll_data = get_technical_analysis("AAPL", interval="60min", indicator="boll",
        ...                                     start_date="2025-10-04", end_date="2025-11-03")
    """
    # Validate inputs
    if not symbol:
        raise ValueError("symbol cannot be empty")
    
    valid_intervals = ["1min", "5min", "15min", "30min", "60min", "daily", "weekly", "monthly", "quarterly", "yearly"]
    if interval.lower() not in valid_intervals:
        raise ValueError(f"Invalid interval: {interval}. Must be one of {valid_intervals}")
    
    valid_indicators = ["close_50_sma", "close_200_sma", "close_10_ema", "macd", "rsi", "boll", "atr", "vwma"]
    if indicator.lower() not in valid_indicators:
        raise ValueError(f"Invalid indicator: {indicator}. Must be one of {valid_indicators}")
    
    valid_formats = ["json", "csv"]
    if format.lower() not in valid_formats:
        raise ValueError(f"Invalid format: {format}. Must be one of {valid_formats}")
    
    # Convert indicator to lowercase for consistent processing
    indicator = indicator.lower()
    
    logger.info(f"Fetching technical analysis for {symbol}: {indicator} with interval={interval}, start_date={start_date}, end_date={end_date}, format={format}")
    
    try:
        params = {
            "symbol": symbol,
            "interval": interval,
            "indicator": indicator,
            "format": format
        }
        
        # Add optional date parameters if provided
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        
        response = _make_request(
            method="GET",
            endpoint="/api/technical-analysis",
            params=params
        )
        
        logger.info(f"Successfully retrieved {indicator} data for {symbol} in {format} format")
        return response
        
    except FutuAPIError as e:
        logger.error(f"Failed to get technical analysis for {symbol}: {e}")
        raise


def get_hot_news(
    lang: Annotated[str, "Language code: zh-cn, zh-hk, or en-us"] = "zh-cn"
) -> List[Dict[str, Any]]:
    """
    Get hot/trending news articles.
    
    Args:
        lang: Language code (zh-cn/zh-hk/en-us), defaults to zh-cn
        
    Returns:
        list: List of news articles, each containing:
            - title: News title
            - url: Article URL
            - source: News source
            - publish_time: Publication time
            - summary: Brief summary (if available)
            - related_stocks: Related stock symbols (if available)
            
    Raises:
        FutuAPIError: If API call fails
        ValueError: If language code is invalid
        
    Example:
        >>> # Get Chinese news
        >>> news = get_hot_news("zh-cn")
        >>> for article in news[:5]:
        ...     print(f"{article['title']}")
        
        >>> # Get English news
        >>> news_en = get_hot_news("en-us")
    """
    # Validate language code
    if lang.lower() not in ["zh-cn", "zh-hk", "en-us"]:
        raise ValueError(f"Invalid lang: {lang}. Must be zh-cn, zh-hk, or en-us")
    
    logger.info(f"Fetching hot news in {lang}")
    
    try:
        response = _make_request(
            method="GET",
            endpoint="/api/hot-news",
            params={"lang": lang}
        )
        
        # Handle different response formats
        if isinstance(response, list):
            news = response
        elif isinstance(response, dict) and "news" in response:
            news = response["news"]
        elif isinstance(response, dict) and "data" in response:
            news = response["data"]
        else:
            news = []
        
        logger.info(f"Successfully retrieved {len(news)} news articles in {lang}")
        return news
        
    except FutuAPIError as e:
        logger.error(f"Failed to get hot news in {lang}: {e}")
        raise
