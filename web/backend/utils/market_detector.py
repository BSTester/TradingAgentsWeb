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
    
    支持的格式：
    - 美股：1-5个字母（NYSE通常1-3个，NASDAQ通常4-5个）
    - 港股：5位数字（2008年后统一为5位，兼容4位旧格式），可选.HK后缀
    - A股沪市：600/601/603/605（主板）、688（科创板）开头，可选.SH后缀
    - A股深市：000/001（主板）、002（中小板）、300/301（创业板）开头，可选.SZ后缀
    
    Args:
        ticker: 股票代码
        
    Returns:
        是否有效
        
    Examples:
        >>> validate_ticker("AAPL")  # 美股
        True
        >>> validate_ticker("00700")  # 港股（腾讯）
        True
        >>> validate_ticker("00700.HK")  # 港股带后缀
        True
        >>> validate_ticker("600519")  # 沪市主板（贵州茅台）
        True
        >>> validate_ticker("600519.SH")  # 沪市主板带后缀
        True
        >>> validate_ticker("688001")  # 科创板
        True
        >>> validate_ticker("000001.SZ")  # 深市主板（平安银行）
        True
        >>> validate_ticker("300750")  # 创业板（宁德时代）
        True
        >>> validate_ticker("123456")  # 不符合沪深规则
        False
        >>> validate_ticker("INVALID123")  # 混合字母数字
        False
    """
    ticker = normalize_ticker(ticker)
    
    # 港股：5位数字（2008年后统一），兼容4位旧格式，可选.HK后缀
    if ticker.endswith('.HK'):
        base = ticker[:-3]
        return base.isdigit() and 4 <= len(base) <= 5
    
    # A股：必须是6位数字，且符合沪深市场规则
    if ticker.isdigit() and len(ticker) == 6:
        prefix3 = ticker[:3]
        # 沪市主板：600、601、603、605开头
        # 科创板：688开头
        # 深市主板：000、001开头
        # 中小板：002开头
        # 创业板：300、301开头
        return prefix3 in ('600', '601', '603', '605', '688', 
                          '000', '001', '002', '300', '301')
    
    # A股带后缀：.SH（沪市）或.SZ（深市）
    if ticker.endswith(('.SH', '.SZ')):
        base = ticker[:-3]
        if not (base.isdigit() and len(base) == 6):
            return False
        
        prefix3 = base[:3]
        
        if ticker.endswith('.SH'):
            # 沪市：600、601、603、605、688开头
            return prefix3 in ('600', '601', '603', '605', '688')
        else:
            # 深市：000、001、002、300、301开头
            return prefix3 in ('000', '001', '002', '300', '301')
    
    # 港股：4-5位纯数字（不带后缀）
    if ticker.isdigit() and 4 <= len(ticker) <= 5:
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
        >>> detect_market("000001.SZ")
        'CN'
    """
    ticker = normalize_ticker(ticker)
    
    # 港股：带.HK后缀
    if ticker.endswith('.HK'):
        return 'HK'
    
    # A股：带.SH或.SZ后缀
    if ticker.endswith(('.SH', '.SZ')):
        return 'CN'
    
    # 6位数字：检查是否符合A股规则
    if ticker.isdigit() and len(ticker) == 6:
        prefix3 = ticker[:3]
        # 沪市或深市
        if prefix3 in ('600', '601', '603', '605', '688',
                      '000', '001', '002', '300', '301'):
            return 'CN'
    
    # 4-5位数字：港股
    if ticker.isdigit() and 4 <= len(ticker) <= 5:
        return 'HK'
    
    # 默认为美股
    return 'US'
