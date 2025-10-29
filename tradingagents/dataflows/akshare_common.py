"""
AkShare Common Utilities
Shared functions for market identification, symbol normalization, and data formatting
"""

import logging
from typing import Dict, Any

# Market identification patterns
MARKET_PATTERNS = {
    'A_STOCK': {
        'description': 'A股市场 (深圳/上海/科创板/创业板/北交所)',
        'patterns': [
            lambda s: s.isdigit() and len(s) == 6,
            lambda s: s.upper().endswith(('.SZ', '.SH'))
        ]
    },
    'HK_STOCK': {
        'description': '港股市场',
        'patterns': [
            lambda s: s.upper().endswith('.HK'),
            lambda s: s.isdigit() and 1 <= len(s) <= 5
        ]
    },
    'US_STOCK': {
        'description': '美股市场',
        'patterns': [
            lambda s: any(c.isalpha() for c in s) and not s.upper().endswith(('.HK', '.SZ', '.SH'))
        ]
    }
}


def _identify_market(symbol: str) -> str:
    """
    Identify the market based on stock symbol format.
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Market type: 'A_STOCK', 'HK_STOCK', 'US_STOCK', or 'UNKNOWN'
    """
    if not symbol:
        return 'UNKNOWN'
    
    symbol = symbol.strip()
    
    # Check each market pattern
    for market, config in MARKET_PATTERNS.items():
        for pattern in config['patterns']:
            try:
                if pattern(symbol):
                    return market
            except:
                continue
    
    return 'UNKNOWN'


def normalize_symbol_for_sina(ticker: str, market: str) -> str:
    """
    Normalize symbol for Sina Finance API
    A股需要添加市场前缀: sh/sz/bj
    
    Args:
        ticker: Stock symbol
        market: Market type
        
    Returns:
        Normalized symbol with market prefix
    """
    if market != 'A_STOCK':
        return ticker
    
    # 已经有前缀，直接返回
    if ticker.lower().startswith(('sh', 'sz', 'bj')):
        return ticker
    
    # 根据代码开头判断市场
    if ticker.startswith(('60', '68')):  # 上海主板/科创板
        return f"sh{ticker}"
    elif ticker.startswith(('00', '30')):  # 深圳主板/创业板
        return f"sz{ticker}"
    elif ticker.startswith(('83', '87')):  # 北交所
        return f"bj{ticker}"
    else:
        # 默认上海
        return f"sh{ticker}"


def normalize_symbol_for_us(ticker: str) -> str:
    """
    Normalize symbol for US stocks
    处理特殊符号: BRK.A → BRK_A
    
    Args:
        ticker: Stock symbol
        
    Returns:
        Normalized symbol
    """
    return ticker.replace('.', '_')


def normalize_symbol_for_hk(ticker: str) -> str:
    """
    Normalize symbol for HK stocks
    标准化为5位数字，去除 .HK 后缀
    
    Args:
        ticker: Stock symbol
        
    Returns:
        Normalized 5-digit symbol
    """
    symbol_upper = ticker.upper()
    if symbol_upper.endswith('.HK'):
        num = symbol_upper[:-3]
        if num.isdigit():
            return num.zfill(5)
    elif ticker.isdigit():
        return ticker.zfill(5)
    return ticker


def map_frequency(freq: str, market: str) -> str:
    """
    Map frequency parameter to market-specific values
    
    Args:
        freq: Frequency ('annual' or 'quarterly')
        market: Market type
        
    Returns:
        Market-specific frequency string
    """
    freq_lower = freq.lower()
    
    if market == 'A_STOCK':
        # Sina: 不需要特殊映射
        return freq_lower
    elif market == 'US_STOCK':
        # EastMoney US: 年报/单季报/累计季报
        if freq_lower == 'annual':
            return '年报'
        elif freq_lower == 'quarterly':
            return '单季报'
        else:
            return '年报'  # 默认
    elif market == 'HK_STOCK':
        # EastMoney HK: 年度/报告期
        if freq_lower == 'annual':
            return '年度'
        else:
            return '报告期'
    
    return freq_lower


def map_statement_type(statement_type: str, market: str) -> str:
    """
    Map statement type to market-specific names
    
    Args:
        statement_type: Type of statement ('balance_sheet', 'cashflow', 'income_statement')
        market: Market type
        
    Returns:
        Market-specific statement name
    """
    type_mapping = {
        'balance_sheet': {
            'A_STOCK': '资产负债表',
            'US_STOCK': '资产负债表',
            'HK_STOCK': '资产负债表'
        },
        'cashflow': {
            'A_STOCK': '现金流量表',
            'US_STOCK': '现金流量表',
            'HK_STOCK': '现金流量表'
        },
        'income_statement': {
            'A_STOCK': '利润表',
            'US_STOCK': '综合损益表',  # 注意：美股是"综合损益表"
            'HK_STOCK': '利润表'
        }
    }
    
    return type_mapping.get(statement_type, {}).get(market, statement_type)


def format_large_number(value: float, item_name: str = '') -> str:
    """
    Format large numbers with appropriate units (亿/万)
    
    Args:
        value: Numeric value
        item_name: Name of the item (for context)
        
    Returns:
        Formatted string
    """
    import pandas as pd
    
    if pd.isna(value) or value == 'N/A' or str(value) == 'None':
        return 'N/A'
    
    try:
        if isinstance(value, str):
            value = float(value.replace(',', ''))
        
        # 每股数据保留4位小数
        if '每股' in item_name or 'EPS' in item_name or 'per share' in item_name.lower():
            return f"{value:.4f}元"
        
        # 大数字格式化
        if abs(value) > 100000000:  # 超过1亿
            return f"{value/100000000:.2f}亿"
        elif abs(value) > 10000:  # 超过1万
            return f"{value/10000:.2f}万"
        else:
            return f"{value:.2f}"
    except:
        return str(value)


def check_akshare_available() -> bool:
    """
    Check if akshare is available
    
    Returns:
        True if akshare is installed and can be imported
    """
    try:
        import akshare
        return True
    except ImportError:
        return False


def get_akshare():
    """
    Get akshare module or None if not available
    
    Returns:
        akshare module or None
    """
    try:
        import akshare as ak
        return ak
    except ImportError:
        logging.error("akshare not installed")
        return None
