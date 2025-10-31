"""
AKShare data provider - Main entry point
Imports all functions from specialized modules following alpha_vantage.py pattern
"""

# Import from specialized modules
from .akshare_stock import get_stock, get_stock_realtime_quote
from .akshare_indicator import get_indicators
from .akshare_fundamentals import (
    get_fundamentals,
    get_balance_sheet,
    get_cashflow,
    get_income_statement
)
from .akshare_news import (
    get_news,
    get_global_news,
    get_insider_transactions,
    get_insider_sentiment
)

# Export common utilities for backward compatibility
from .akshare_common import (
    _identify_market,
    MARKET_PATTERNS,
    normalize_symbol_for_sina,
    normalize_symbol_for_us,
    normalize_symbol_for_hk,
    check_akshare_available,
    get_akshare
)

__all__ = [
    # Stock data
    'get_stock',
    'get_stock_realtime_quote',
    # Technical indicators
    'get_indicators',
    # Fundamentals
    'get_fundamentals',
    'get_balance_sheet',
    'get_cashflow',
    'get_income_statement',
    # News and sentiment
    'get_news',
    'get_global_news',
    'get_insider_transactions',
    'get_insider_sentiment',
    # Common utilities
    '_identify_market',
    'MARKET_PATTERNS',
    'normalize_symbol_for_sina',
    'normalize_symbol_for_us',
    'normalize_symbol_for_hk',
    'check_akshare_available',
    'get_akshare'
]
