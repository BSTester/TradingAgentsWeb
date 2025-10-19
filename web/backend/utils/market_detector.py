#!/usr/bin/env python3
"""
Market detection and ticker validation utilities for TradingAgents Web Interface
"""


def normalize_ticker(ticker: str) -> str:
    """
    标准化股票代码：去除空格并转大写
    
    Args:
        ticker: 原始股票代码
        
    Returns:
        标准化后的股票代码
        
    Examples:
        >>> normalize_ticker("aapl")
        'AAPL'
        >>> normalize_ticker(" msft ")
        'MSFT'
        >>> normalize_ticker("0 7 0 0")
        '0700'
    """
    return ticker.upper().strip().replace(' ', '')


def validate_ticker(ticker: str) -> bool:
    """
    校验股票代码格式是否有效
    
    Args:
        ticker: 股票代码
        
    Returns:
        是否有效
        
    Examples:
        >>> validate_ticker("AAPL")
        True
        >>> validate_ticker("0700")
        True
        >>> validate_ticker("600000")
        True
        >>> validate_ticker("INVALID123")
        False
    """
    ticker = normalize_ticker(ticker)
    
    # 港股：4-5位数字或带.HK后缀
    if ticker.endswith('.HK'):
        base = ticker[:-3]
        return base.isdigit() and 4 <= len(base) <= 5
    if ticker.isdigit() and 4 <= len(ticker) <= 5:
        return True
    
    # A股：6位数字或带.SH/.SS后缀
    if ticker.endswith(('.SH', '.SS')):
        base = ticker[:-3]
        return base.isdigit() and len(base) == 6
    if ticker.isdigit() and len(ticker) == 6:
        return True
    
    # 美股：1-5个字母
    if ticker.isalpha() and 1 <= len(ticker) <= 5:
        return True
    
    return False


def detect_market(ticker: str) -> str:
    """
    根据股票代码识别市场类型
    
    Args:
        ticker: 股票代码（已标准化）
        
    Returns:
        市场类型: 'US', 'HK', 'CN'
        
    Examples:
        >>> detect_market("AAPL")
        'US'
        >>> detect_market("0700")
        'HK'
        >>> detect_market("0700.HK")
        'HK'
        >>> detect_market("600000")
        'CN'
        >>> detect_market("600000.SH")
        'CN'
    """
    ticker = normalize_ticker(ticker)
    
    # 港股：4-5位数字或带.HK后缀
    if ticker.endswith('.HK') or (ticker.isdigit() and 4 <= len(ticker) <= 5):
        return 'HK'
    
    # A股：6位数字或带.SH/.SS后缀
    if ticker.endswith(('.SH', '.SS')) or (ticker.isdigit() and len(ticker) == 6):
        return 'CN'
    
    # 默认为美股
    return 'US'
