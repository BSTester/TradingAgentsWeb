from typing import Annotated

# Import from vendor-specific modules
from .local import get_YFin_data, get_finnhub_news, get_finnhub_company_insider_sentiment, get_finnhub_company_insider_transactions, get_simfin_balance_sheet, get_simfin_cashflow, get_simfin_income_statements, get_reddit_global_news, get_reddit_company_news
from .y_finance import get_YFin_data_online, get_stock_stats_indicators_window, get_balance_sheet as get_yfinance_balance_sheet, get_cashflow as get_yfinance_cashflow, get_income_statement as get_yfinance_income_statement, get_insider_transactions as get_yfinance_insider_transactions
from .google import get_google_news as _get_google_news
from .openai import get_stock_news_openai as _get_stock_news_openai, get_global_news_openai, get_fundamentals_openai
from .alpha_vantage import (
    get_stock as get_alpha_vantage_stock,
    get_indicator as _get_alpha_vantage_indicator,
    get_fundamentals as get_alpha_vantage_fundamentals,
    get_balance_sheet as get_alpha_vantage_balance_sheet,
    get_cashflow as get_alpha_vantage_cashflow,
    get_income_statement as get_alpha_vantage_income_statement,
    get_insider_transactions as _get_alpha_vantage_insider_transactions,
    get_news as get_alpha_vantage_news
)

# Wrapper functions to fix parameter compatibility
def get_alpha_vantage_insider_transactions(ticker: str) -> str:
    """Wrapper to convert ticker parameter to symbol for Alpha Vantage"""
    return _get_alpha_vantage_insider_transactions(symbol=ticker)

def get_google_news(ticker: str, start_date: str, end_date: str) -> str:
    """Wrapper to convert date parameters for Google news"""
    from datetime import datetime, timedelta
    # Convert start_date to curr_date and calculate look_back_days
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    look_back_days = (end_dt - start_dt).days
    return _get_google_news(query=ticker, curr_date=end_date, look_back_days=look_back_days)

def get_stock_news_openai(ticker: str, start_date: str, end_date: str) -> str:
    """Wrapper to convert ticker parameter to query for OpenAI"""
    return _get_stock_news_openai(query=ticker, start_date=start_date, end_date=end_date)

def get_alpha_vantage_indicator(symbol: str, indicator: str, curr_date: str, look_back_days: int) -> str:
    """Wrapper to provide default parameters for Alpha Vantage indicators"""
    return _get_alpha_vantage_indicator(
        symbol=symbol, 
        indicator=indicator, 
        curr_date=curr_date, 
        look_back_days=look_back_days,
        interval="daily",  # Default interval
        time_period=14,    # Default time period
        series_type="close"  # Default series type
    )
from .alpha_vantage_common import AlphaVantageRateLimitError
from .akshare import (
    get_stock as get_akshare_stock,
    get_stock_realtime_quote as get_akshare_realtime_quote,
    get_indicators as get_akshare_indicators,
    get_fundamentals as get_akshare_fundamentals,
    get_balance_sheet as get_akshare_balance_sheet,
    get_cashflow as get_akshare_cashflow,
    get_income_statement as get_akshare_income_statement,
    get_news as get_akshare_news,
    get_insider_transactions as get_akshare_insider_transactions,
    get_global_news as get_akshare_global_news,
    get_insider_sentiment as get_akshare_insider_sentiment
)

# Configuration and routing logic
from .config import get_config

# Tools organized by category
TOOLS_CATEGORIES = {
    "core_stock_apis": {
        "description": "OHLCV stock price data",
        "tools": [
            "get_stock_data",
            "get_realtime_quote"
        ]
    },
    "technical_indicators": {
        "description": "Technical analysis indicators",
        "tools": [
            "get_indicators"
        ]
    },
    "fundamental_data": {
        "description": "Company fundamentals",
        "tools": [
            "get_fundamentals",
            "get_balance_sheet",
            "get_cashflow",
            "get_income_statement"
        ]
    },
    "news_data": {
        "description": "News (public/insiders, original/processed)",
        "tools": [
            "get_news",
            "get_global_news",
            "get_insider_sentiment",
            "get_insider_transactions",
        ]
    }
}

VENDOR_LIST = [
    "local",
    "yfinance", 
    "openai",
    "google",
    "akshare"
]

# Mapping of methods to their vendor-specific implementations
VENDOR_METHODS = {
    # core_stock_apis
    "get_stock_data": {
        "akshare": get_akshare_stock,
        "alpha_vantage": get_alpha_vantage_stock,
        "yfinance": get_YFin_data_online,
        # "local": get_YFin_data,
    },
    "get_realtime_quote": {
        "akshare": get_akshare_realtime_quote,
        # Future: Add other vendors as they become available
        # "yfinance": get_yfinance_realtime_quote,
        # "alpha_vantage": get_alpha_vantage_realtime_quote,
    },
    # technical_indicators
    "get_indicators": {
        "akshare": get_akshare_indicators,
        "alpha_vantage": get_alpha_vantage_indicator,
        "yfinance": get_stock_stats_indicators_window,
        # "local": get_stock_stats_indicators_window
    },
    # fundamental_data
    "get_fundamentals": {
        "akshare": get_akshare_fundamentals,
        "alpha_vantage": get_alpha_vantage_fundamentals,
        "openai": get_fundamentals_openai,
    },
    "get_balance_sheet": {
        "akshare": get_akshare_balance_sheet,
        "alpha_vantage": get_alpha_vantage_balance_sheet,
        "yfinance": get_yfinance_balance_sheet,
        # "local": get_simfin_balance_sheet,
    },
    "get_cashflow": {
        "akshare": get_akshare_cashflow,
        "alpha_vantage": get_alpha_vantage_cashflow,
        "yfinance": get_yfinance_cashflow,
        # "local": get_simfin_cashflow,
    },
    "get_income_statement": {
        "akshare": get_akshare_income_statement,
        "alpha_vantage": get_alpha_vantage_income_statement,
        "yfinance": get_yfinance_income_statement,
        # "local": get_simfin_income_statements,
    },
    # news_data
    "get_news": {
        "akshare": get_akshare_news,
        "alpha_vantage": get_alpha_vantage_news,
        "openai": get_stock_news_openai,
        "google": get_google_news,
        # "local": [get_finnhub_news, get_reddit_company_news, get_google_news],
    },
    "get_global_news": {
        "akshare": get_akshare_global_news,
        "openai": get_global_news_openai,
        # "local": get_reddit_global_news
    },
    "get_insider_sentiment": {
        "akshare": get_akshare_insider_sentiment,
        # "local": get_finnhub_company_insider_sentiment
    },
    "get_insider_transactions": {
        "akshare": get_akshare_insider_transactions,
        "alpha_vantage": get_alpha_vantage_insider_transactions,
        "yfinance": get_yfinance_insider_transactions,
        # "local": get_finnhub_company_insider_transactions,
    },
}

def identify_market(symbol: str) -> str:
    """Identify the market based on stock symbol format.
    
    Returns:
        'A_STOCK': Chinese A-shares (Shanghai/Shenzhen)
        'HK_STOCK': Hong Kong stocks
        'US_STOCK': US stocks
        'UNKNOWN': Cannot determine market
    """
    if not symbol:
        return 'UNKNOWN'
    
    symbol = symbol.upper().strip()
    
    # Chinese A-shares patterns
    if (symbol.startswith(('000', '001', '002', '003')) or  # Shenzhen Main/SME/ChiNext
        symbol.startswith(('600', '601', '603', '605')) or  # Shanghai Main
        symbol.startswith('688') or                         # Shanghai STAR
        symbol.startswith('300') or                         # ChiNext
        symbol.startswith('430') or                         # NEEQ
        symbol.endswith('.SZ') or symbol.endswith('.SH')):  # Explicit exchange suffix
        return 'A_STOCK'
    
    # Hong Kong stocks patterns
    if ((symbol.isdigit() and len(symbol) == 4) or         # 4-digit HK stocks (0001 0700 etc.)
        symbol.endswith('.HK') or                           # Explicit HK suffix
        (symbol.isdigit() and 1 <= int(symbol) <= 9999)):  # HK stock number range
        return 'HK_STOCK'
    
    # US stocks patterns (most flexible as default for alphabetic symbols)
    if (symbol.isalpha() or                                 # Pure alphabetic (AAPL TSLA)
        '.' in symbol or                                    # Contains dot (BRK.A BRK.B)
        symbol.endswith(('.US', '.NASDAQ', '.NYSE')) or     # Explicit US suffixes
        any(c.isalpha() for c in symbol)):                 # Contains letters (mixed format)
        return 'US_STOCK'
    
    return 'UNKNOWN'

def get_market_preferred_vendors(market: str, method: str) -> list:
    """Get preferred vendor order based on market type.
    
    Unified fallback order: akshare → yfinance → alpha_vantage → other vendors
    
    Args:
        market: Market type ('A_STOCK', 'HK_STOCK', 'US_STOCK', 'UNKNOWN')
        method: Method name
        
    Returns:
        List of vendors in preferred order
    """
    # Unified vendor preference order for all markets
    # Priority: akshare → yfinance → alpha_vantage → other vendors
    unified_order = [
        'akshare',           # 1st priority: AKShare (best for A-shares, good coverage)
        'yfinance',          # 2nd priority: yfinance (good for US/HK stocks, free)
        'alpha_vantage',     # 3rd priority: Alpha Vantage (comprehensive but rate-limited)
        'local',             # 4th priority: Local/cached data
        'openai',            # 5th priority: OpenAI-based data
        'google',            # 6th priority: Google-based data
    ]
    
    # Filter to only include vendors that support this method
    if method in VENDOR_METHODS:
        available_vendors = list(VENDOR_METHODS[method].keys())
        filtered_order = [v for v in unified_order if v in available_vendors]
        
        # Add any remaining available vendors not in our preference list
        for vendor in available_vendors:
            if vendor not in filtered_order:
                filtered_order.append(vendor)
                
        return filtered_order
    
    return unified_order

def get_category_for_method(method: str) -> str:
    """Get the category that contains the specified method."""
    for category, info in TOOLS_CATEGORIES.items():
        if method in info["tools"]:
            return category
    raise ValueError(f"Method '{method}' not found in any category")

def get_vendor(category: str, method: str = None) -> str:
    """Get the configured vendor for a data category or specific tool method.
    Tool-level configuration takes precedence over category-level.
    """
    config = get_config()

    # Check tool-level configuration first (if method provided)
    if method:
        tool_vendors = config.get("tool_vendors", {})
        if method in tool_vendors:
            return tool_vendors[method]

    # Fall back to category-level configuration
    return config.get("data_vendors", {}).get(category, "default")

def route_to_vendor(method: str, *args, **kwargs):
    """Route method calls to appropriate vendor implementation with market-aware fallback support."""
    category = get_category_for_method(method)
    
    if method not in VENDOR_METHODS:
        raise ValueError(f"Method '{method}' not supported")

    # Try to extract symbol/ticker from arguments for market identification
    symbol = None
    if args:
        # First positional argument is usually symbol/ticker
        symbol = args[0]
    elif 'symbol' in kwargs:
        symbol = kwargs['symbol']
    elif 'ticker' in kwargs:
        symbol = kwargs['ticker']
    
    # Identify market and get preferred vendor order
    if symbol:
        market = identify_market(symbol)
        fallback_vendors = get_market_preferred_vendors(market, method)
        print(f"DEBUG: Symbol '{symbol}' identified as {market} market")
    else:
        # No symbol provided, use default configuration
        vendor_config = get_vendor(category, method)
        primary_vendors = [v.strip() for v in vendor_config.split(',')]
        all_available_vendors = list(VENDOR_METHODS[method].keys())
        
        fallback_vendors = primary_vendors.copy()
        for vendor in all_available_vendors:
            if vendor not in fallback_vendors:
                fallback_vendors.append(vendor)
        
        market = 'UNKNOWN'
        print(f"DEBUG: No symbol provided, using default vendor configuration")

    # Debug: Print market-aware routing information
    fallback_str = " → ".join(fallback_vendors)
    if symbol:
        print(f"DEBUG: {method} for {market} market ('{symbol}') - Vendor order: [{fallback_str}]")
    else:
        print(f"DEBUG: {method} - Default vendor order: [{fallback_str}]")

    # Track results and execution state
    results = []
    vendor_attempt_count = 0
    successful_vendor = None
    
    # Determine if this method should collect from all vendors (news methods only)
    should_collect_all = method in ['get_news', 'get_global_news']
    
    # Determine primary vendors based on market preferences
    if symbol:
        market_prefs = {
            'A_STOCK': ['akshare'],
            'US_STOCK': ['yfinance', 'alpha_vantage'],
            'HK_STOCK': ['yfinance', 'alpha_vantage'],
            'UNKNOWN': ['yfinance', 'alpha_vantage', 'akshare']
        }
        primary_vendors = market_prefs.get(market, market_prefs['UNKNOWN'])
    else:
        vendor_config = get_vendor(category, method)
        primary_vendors = [v.strip() for v in vendor_config.split(',')]

    for vendor in fallback_vendors:
        if vendor not in VENDOR_METHODS[method]:
            if vendor in primary_vendors:
                print(f"INFO: Vendor '{vendor}' not supported for method '{method}', falling back to next vendor")
            continue

        vendor_impl = VENDOR_METHODS[method][vendor]
        is_primary_vendor = vendor in primary_vendors
        vendor_attempt_count += 1

        # Debug: Print current attempt with market context
        vendor_type = "PRIMARY" if is_primary_vendor else "FALLBACK"
        market_info = f" ({market})" if symbol else ""
        print(f"DEBUG: Attempting {vendor_type} vendor '{vendor}' for {method}{market_info} (attempt #{vendor_attempt_count})")

        # Handle list of methods for a vendor
        if isinstance(vendor_impl, list):
            vendor_methods = [(impl, vendor) for impl in vendor_impl]
            print(f"DEBUG: Vendor '{vendor}' has multiple implementations: {len(vendor_methods)} functions")
        else:
            vendor_methods = [(vendor_impl, vendor)]

        # Run methods for this vendor
        vendor_results = []
        for impl_func, vendor_name in vendor_methods:
            try:
                print(f"DEBUG: Calling {impl_func.__name__} from vendor '{vendor_name}'...")
                result = impl_func(*args, **kwargs)
                vendor_results.append(result)
                print(f"SUCCESS: {impl_func.__name__} from vendor '{vendor_name}' completed successfully")
                    
            except AlphaVantageRateLimitError as e:
                if vendor == "alpha_vantage":
                    print(f"RATE_LIMIT: Alpha Vantage rate limit exceeded, falling back to next available vendor")
                    print(f"DEBUG: Rate limit details: {e}")
                # Continue to next vendor for fallback
                continue
            except Exception as e:
                # Log error but continue with other implementations
                print(f"FAILED: {impl_func.__name__} from vendor '{vendor_name}' failed: {e}")
                continue

        # Add this vendor's results
        if vendor_results:
            results.extend(vendor_results)
            successful_vendor = vendor
            result_summary = f"Got {len(vendor_results)} result(s)"
            print(f"SUCCESS: Vendor '{vendor}' succeeded - {result_summary}")
            
            # Stopping logic: 
            # - News methods (get_news, get_global_news): Collect from ALL vendors
            # - Other methods: Stop after first successful vendor
            if should_collect_all:
                print(f"DEBUG: Continuing to collect from all vendors for '{method}' (news aggregation)")
            else:
                print(f"DEBUG: Stopping after successful vendor '{vendor}' (non-news method)")
                break
        else:
            print(f"FAILED: Vendor '{vendor}' produced no results")

    # Final result summary
    if not results:
        print(f"FAILURE: All {vendor_attempt_count} vendor attempts failed for method '{method}'")
        raise RuntimeError(f"All vendor implementations failed for method '{method}'")
    else:
        print(f"FINAL: Method '{method}' completed with {len(results)} result(s) from {vendor_attempt_count} vendor attempt(s)")

    # Return single result if only one, otherwise concatenate as string
    if len(results) == 1:
        return results[0]
    else:
        # Convert all results to strings and concatenate
        return '\n'.join(str(result) for result in results)