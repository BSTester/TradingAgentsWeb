from typing import Annotated

# Import from vendor-specific modules
from .local import get_YFin_data, get_finnhub_news, get_finnhub_company_insider_sentiment, get_finnhub_company_insider_transactions, get_simfin_balance_sheet, get_simfin_cashflow, get_simfin_income_statements, get_reddit_global_news, get_reddit_company_news

# Import from yfinance module
from .y_finance import get_YFin_data_online, get_stock_stats_indicators_window, get_balance_sheet as get_yfinance_balance_sheet, get_cashflow as get_yfinance_cashflow, get_income_statement as get_yfinance_income_statement, get_insider_transactions as get_yfinance_insider_transactions

from .google import get_google_news
from .openai import get_stock_news_openai, get_global_news_openai, get_fundamentals_openai
from .alpha_vantage import (
    get_stock as get_alpha_vantage_stock,
    get_indicator as get_alpha_vantage_indicator,
    get_fundamentals as get_alpha_vantage_fundamentals,
    get_balance_sheet as get_alpha_vantage_balance_sheet,
    get_cashflow as get_alpha_vantage_cashflow,
    get_income_statement as get_alpha_vantage_income_statement,
    get_insider_transactions as get_alpha_vantage_insider_transactions,
    get_news as get_alpha_vantage_news
)
from .alpha_vantage_common import AlphaVantageRateLimitError
# Import AKShare and BaoStock modules
from .akshare import (
    get_akshare_stock_data,
    get_akshare_realtime_data,
    get_akshare_company_info,
    get_akshare_balance_sheet,
    get_akshare_income_statement,
    get_akshare_cashflow,
    get_akshare_fundamentals,
    get_akshare_financial_data,
    get_akshare_stock_news,
    get_akshare_global_news,
    get_akshare_market_sentiment,
    get_akshare_aggregated_news,
    get_akshare_enhanced_market_sentiment,
    get_akshare_indicators
)
from .baostock import (
    get_baostock_stock_data,
    get_baostock_company_info,
    get_baostock_realtime_data,
    get_baostock_dividend_data,
    get_baostock_balance_sheet,
    get_baostock_income_statement,
    get_baostock_cashflow,
    get_baostock_fundamentals,
    get_baostock_financial_data
)
from .market_utils import MarketIdentifier, get_market_info

# Configuration and routing logic
from .config import get_config


def _is_indicator_result_invalid(result_content: str) -> bool:
    """
    检查技术指标结果是否包含有效数据
    如果所有日期都显示为节假日或无效数据，则返回True
    """
    if not result_content or not isinstance(result_content, str):
        return True
    
    lines = result_content.split('\n')
    valid_data_count = 0
    date_line_count = 0
    
    for line in lines:
        line = line.strip()
        # 匹配日期行格式: YYYY-MM-DD: value
        if ':' in line and len(line.split(':')[0].strip()) == 10:
            try:
                # 尝试解析日期部分
                date_part = line.split(':')[0].strip()
                from datetime import datetime
                datetime.strptime(date_part, '%Y-%m-%d')
                date_line_count += 1
                
                # 检查值部分是否为有效数据
                value_part = ':'.join(line.split(':')[1:]).strip()
                if not any(keyword in value_part.lower() for keyword in [
                    'n/a', 'not a trading day', 'weekend', 'holiday', 'invalid', 
                    'no data', 'error', 'failed', '无数据', '节假日', '非交易日'
                ]):
                    # 尝试解析为数字
                    try:
                        float(value_part)
                        valid_data_count += 1
                    except ValueError:
                        # 如果不是数字但也不是错误信息，可能是其他有效格式
                        if value_part and len(value_part) > 0:
                            valid_data_count += 1
            except ValueError:
                # 不是日期行，跳过
                continue
    
    # 如果有日期行但没有有效数据，或者有效数据比例太低，则认为无效
    if date_line_count == 0:
        return True  # 没有任何日期数据
    
    valid_ratio = valid_data_count / date_line_count
    # 如果有效数据比例低于30%，认为数据质量不佳
    return valid_ratio < 0.3

# Tools organized by category
TOOLS_CATEGORIES = {
    "core_stock_apis": {
        "description": "OHLCV stock price data",
        "tools": [
            "get_stock_data"
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
    },
    "realtime_data": {
        "description": "Real-time market data",
        "tools": [
            "get_realtime_data"
        ]
    },
    "dividend_data": {
        "description": "Dividend and corporate actions",
        "tools": [
            "get_dividend_data"
        ]
    }
}

VENDOR_LIST = [
    "local",
    "yfinance",
    "akshare",
    "baostock",
    "alpha_vantage",
    "openai",
    "google"
]

# Mapping of methods to their vendor-specific implementations
VENDOR_METHODS = {
    # core_stock_apis
    "get_stock_data": {
        "alpha_vantage": get_alpha_vantage_stock,
        "yfinance": get_YFin_data_online,
        "akshare": get_akshare_stock_data,
        "baostock": get_baostock_stock_data,
        "local": get_YFin_data,
    },
    # technical_indicators
    "get_indicators": {
        "alpha_vantage": get_alpha_vantage_indicator,
        "yfinance": get_stock_stats_indicators_window,
        "akshare": get_akshare_indicators,
        "local": get_stock_stats_indicators_window
    },
    # fundamental_data
    "get_fundamentals": {
        "alpha_vantage": get_alpha_vantage_fundamentals,
        "akshare": get_akshare_company_info,
        "baostock": get_baostock_fundamentals,
        "openai": get_fundamentals_openai,
    },
    "get_balance_sheet": {
        "alpha_vantage": get_alpha_vantage_balance_sheet,
        "yfinance": get_yfinance_balance_sheet,
        "akshare": lambda symbol, freq="quarterly", curr_date=None: get_akshare_financial_data(symbol, "balance_sheet"),
        "baostock": lambda symbol, freq="quarterly", curr_date=None: get_baostock_balance_sheet(symbol),
        "local": get_simfin_balance_sheet,
    },
    "get_cashflow": {
        "alpha_vantage": get_alpha_vantage_cashflow,
        "yfinance": get_yfinance_cashflow,
        "akshare": lambda symbol, freq="quarterly", curr_date=None: get_akshare_financial_data(symbol, "cashflow"),
        "baostock": lambda symbol, freq="quarterly", curr_date=None: get_baostock_cashflow(symbol),
        "local": get_simfin_cashflow,
    },
    "get_income_statement": {
        "alpha_vantage": get_alpha_vantage_income_statement,
        "yfinance": get_yfinance_income_statement,
        "akshare": lambda symbol, freq="quarterly", curr_date=None: get_akshare_financial_data(symbol, "income_statement"),
        "baostock": lambda symbol, freq="quarterly", curr_date=None: get_baostock_income_statement(symbol),
        "local": get_simfin_income_statements,
    },
    # news_data
    "get_news": {
        "akshare": get_akshare_stock_news,
        "alpha_vantage": get_alpha_vantage_news,
        "openai": get_stock_news_openai,
        "google": get_google_news,
        "local": [get_finnhub_news, get_reddit_company_news, get_google_news],
    },
    "get_global_news": {
        "akshare": get_akshare_global_news,
        "openai": get_global_news_openai,
        "local": get_reddit_global_news
    },
    "get_insider_sentiment": {
        "akshare": get_akshare_market_sentiment,
        "local": get_finnhub_company_insider_sentiment
    },
    "get_insider_transactions": {
        "alpha_vantage": get_alpha_vantage_insider_transactions,
        "yfinance": get_yfinance_insider_transactions,
        "local": get_finnhub_company_insider_transactions,
    },
    # Additional methods for new data sources
    "get_realtime_data": {
        "akshare": get_akshare_realtime_data,
    },
    "get_dividend_data": {
        "baostock": lambda symbol, year=None, year_type="report": get_baostock_dividend_data(symbol, year, year_type),
    },
}

def get_category_for_method(method: str) -> str:
    """Get the category that contains the specified method."""
    for category, info in TOOLS_CATEGORIES.items():
        if method in info["tools"]:
            return category
    raise ValueError(f"Method '{method}' not found in any category")

def get_vendor(category: str, method: str = None, symbol: str = None) -> str:
    """Get the configured vendor for a data category or specific tool method.
    Market-specific configuration takes precedence over tool-level configuration.
    Tool-level configuration takes precedence over category-level.
    """
    config = get_config()

    # Check market-specific configuration first if symbol is provided
    if symbol:
        market_info = get_market_info(symbol)
        market = market_info['market']
        market_vendors = config.get("market_vendors", {})
        
        if market in market_vendors:
            market_config = market_vendors[market]
            primary = market_config.get("primary", "")
            fallback = market_config.get("fallback", "")
            
            # Combine primary and fallback vendors
            if primary and fallback:
                return f"{primary},{fallback}"
            elif primary:
                return primary
            elif fallback:
                return fallback

    # Check tool-level configuration (if method provided)
    if method:
        tool_vendors = config.get("tool_vendors", {})
        if method in tool_vendors:
            return tool_vendors[method]

    # Fall back to category-level configuration
    return config.get("data_vendors", {}).get(category, "default")

def route_to_vendor(method: str, *args, **kwargs):
    """Route method calls to appropriate vendor implementation with fallback support."""
    category = get_category_for_method(method)
    
    # Extract symbol from args for smart routing
    symbol = None
    if args and len(args) > 0:
        # First argument is usually the symbol
        symbol = args[0]
    elif 'symbol' in kwargs:
        symbol = kwargs['symbol']
    elif 'ticker' in kwargs:
        symbol = kwargs['ticker']
    
    vendor_config = get_vendor(category, method, symbol)

    # Handle comma-separated vendors
    primary_vendors = [v.strip() for v in vendor_config.split(',')]

    if method not in VENDOR_METHODS:
        raise ValueError(f"Method '{method}' not supported")

    # Use only configured vendors for market-specific configurations
    # Only add additional vendors as fallback for tool-level or category-level configs
    current_config = get_config()
    if symbol and get_market_info(symbol)['market'] in current_config.get("market_vendors", {}):
        # For market-specific configs, use only configured vendors
        fallback_vendors = primary_vendors.copy()
    else:
        # For tool-level or category-level configs, add all available vendors as additional fallback
        all_available_vendors = list(VENDOR_METHODS[method].keys())
        fallback_vendors = primary_vendors.copy()
        for vendor in all_available_vendors:
            if vendor not in fallback_vendors:
                fallback_vendors.append(vendor)

    # Debug: Print fallback ordering
    primary_str = " → ".join(primary_vendors)
    fallback_str = " → ".join(fallback_vendors)


    # Track results and execution state
    results = []
    vendor_attempt_count = 0
    any_primary_vendor_attempted = False
    successful_vendor = None

    for vendor in fallback_vendors:
        if vendor not in VENDOR_METHODS[method]:
            if vendor in primary_vendors:
                print(f"INFO: Vendor '{vendor}' not supported for method '{method}', falling back to next vendor")
            continue

        vendor_impl = VENDOR_METHODS[method][vendor]
        is_primary_vendor = vendor in primary_vendors
        vendor_attempt_count += 1

        # Track if we attempted any primary vendor
        if is_primary_vendor:
            any_primary_vendor_attempted = True

        # Debug: Print current attempt
        vendor_type = "PRIMARY" if is_primary_vendor else "FALLBACK"


        # Handle list of methods for a vendor
        if isinstance(vendor_impl, list):
            vendor_methods = [(impl, vendor) for impl in vendor_impl]

        else:
            vendor_methods = [(vendor_impl, vendor)]

        # Run methods for this vendor
        vendor_results = []
        for impl_func, vendor_name in vendor_methods:
            try:

                result = impl_func(*args, **kwargs)
                vendor_results.append(result)
                print(f"SUCCESS: {impl_func.__name__} from vendor '{vendor_name}' completed successfully")
                    
            except AlphaVantageRateLimitError as e:
                if vendor == "alpha_vantage":
                    print(f"RATE_LIMIT: Alpha Vantage rate limit exceeded, falling back to next available vendor")

                # Continue to next vendor for fallback
                continue
            except (ConnectionError, ConnectionAbortedError, 
                    ConnectionResetError, TimeoutError) as e:
                # Network-related errors should trigger fallback
                print(f"NETWORK_ERROR: {impl_func.__name__} from vendor '{vendor_name}' failed with network error: {e}")
                print(f"INFO: Attempting fallback to next vendor...")
                continue
            except Exception as e:
                # Check if the error contains network-related keywords
                error_str = str(e).lower()
                if any(keyword in error_str for keyword in ['connection', 'network', 'timeout', 'remote', 'aborted']):
                    print(f"NETWORK_ERROR: {impl_func.__name__} from vendor '{vendor_name}' failed with connection issue: {e}")
                    print(f"INFO: Attempting fallback to next vendor...")
                    continue
                else:
                    # Log error but continue with other implementations
                    print(f"FAILED: {impl_func.__name__} from vendor '{vendor_name}' failed: {e}")
                    continue

        # Add this vendor's results
        if vendor_results:
            # 针对技术指标，检查结果是否包含有效数据
            should_fallback_due_to_invalid_data = False
            if method == 'get_indicators' and len(vendor_results) == 1:
                result_content = str(vendor_results[0])
                # 检查是否所有日期都是节假日/无效数据
                if _is_indicator_result_invalid(result_content):
                    should_fallback_due_to_invalid_data = True
                    print(f"DATA_QUALITY: Vendor '{vendor}' returned no valid indicator data (all dates marked as holidays/invalid)")
                    print(f"INFO: Attempting fallback to next vendor for better data quality...")
            
            if should_fallback_due_to_invalid_data:
                # 不添加到results，继续尝试下一个vendor
                print(f"FALLBACK: Skipping vendor '{vendor}' due to invalid data quality")
            else:
                results.extend(vendor_results)
                successful_vendor = vendor
                result_summary = f"Got {len(vendor_results)} result(s)"
                print(f"SUCCESS: Vendor '{vendor}' succeeded - {result_summary}")
                
                # Stopping logic: 
                # For single-vendor configs, stop after first success
                # For get_indicators and similar tools, stop after first success (fallback mode)
                # For news aggregation tools, may want to collect from multiple sources
                stop_after_first_success = (
                    len(primary_vendors) == 1 or 
                    method in ['get_indicators', 'get_stock_data']  # Add methods that should use fallback-only mode
                )
                
                if stop_after_first_success:

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