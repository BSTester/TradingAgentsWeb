"""
Market Utility Functions
Common utilities for market type detection and stock code processing.
"""


def detect_market_type(stock_code: str) -> str:
    """
    Detect market type based on stock code format.
    
    Supports various stock code formats:
    - HK stocks: 
      * 5-digit numbers: 00700, 01810
      * 4-digit numbers: 0700, 1810 (without leading zero)
      * With suffix: 0700.HK, 00700.HK
    - CN stocks (A-shares):
      * 6-digit numbers: 600519, 688xxx, 000001, 300xxx
      * With suffix: 600519.SH, 000001.SZ
    - US stocks:
      * Letters: AAPL, TSLA, MSFT
      * With dots: BRK.A, BRK.B
      * Mixed: SPY, QQQ
    
    Args:
        stock_code: Stock symbol in various formats
        
    Returns:
        str: Market type (US/HK/CN)
        
    Examples:
        >>> detect_market_type("AAPL")
        'US'
        >>> detect_market_type("00700")
        'HK'
        >>> detect_market_type("0700.HK")
        'HK'
        >>> detect_market_type("600519")
        'CN'
        >>> detect_market_type("600519.SH")
        'CN'
        >>> detect_market_type("BRK.A")
        'US'
    """
    if not stock_code:
        return "US"
    
    stock_code = stock_code.strip().upper()
    
    # Check for explicit market suffixes
    if stock_code.endswith('.HK'):
        return "HK"
    if stock_code.endswith('.SH') or stock_code.endswith('.SZ'):
        return "CN"
    
    # Remove suffix for further analysis
    base_code = stock_code.split('.')[0]
    
    # Check if pure digits
    if base_code.isdigit():
        code_len = len(base_code)
        if code_len == 5:
            # 5-digit number -> HK stock (e.g., 00700, 01810)
            return "HK"
        elif code_len == 6:
            # 6-digit number -> CN stock (e.g., 600519, 688xxx, 000001, 300xxx)
            return "CN"
        elif code_len == 4:
            # 4-digit number -> likely HK stock without leading zero (e.g., 0700 -> 700)
            return "HK"
        elif code_len == 3:
            # 3-digit number -> could be HK stock (e.g., 700)
            return "HK"
    
    # Check if contains letters (US stock or other)
    if any(c.isalpha() for c in base_code):
        # US stocks typically have letters (AAPL, TSLA, BRK, etc.)
        return "US"
    
    # Default to US if cannot determine
    return "US"


def normalize_stock_code(stock_code: str, market_type: str = None) -> str:
    """
    Normalize stock code to a standard format.
    
    Args:
        stock_code: Original stock code
        market_type: Optional market type (US/HK/CN), will auto-detect if not provided
        
    Returns:
        str: Normalized stock code
        
    Examples:
        >>> normalize_stock_code("700", "HK")
        '00700'
        >>> normalize_stock_code("0700.HK")
        '00700'
        >>> normalize_stock_code("AAPL")
        'AAPL'
        >>> normalize_stock_code("600519.SH")
        '600519'
    """
    if not stock_code:
        return stock_code
    
    stock_code = stock_code.strip().upper()
    
    # Auto-detect market type if not provided
    if market_type is None:
        market_type = detect_market_type(stock_code)
    
    # Remove market suffix
    base_code = stock_code.split('.')[0]
    
    # Normalize based on market type
    if market_type == "HK":
        # HK stocks should be 5 digits with leading zeros
        if base_code.isdigit():
            return base_code.zfill(5)
    elif market_type == "CN":
        # CN stocks should be 6 digits
        if base_code.isdigit():
            return base_code.zfill(6)
    
    # For US stocks or others, return base code as-is
    return base_code


def add_market_suffix(stock_code: str, market_type: str = None) -> str:
    """
    Add market suffix to stock code if not present.
    
    Args:
        stock_code: Stock code
        market_type: Optional market type (US/HK/CN), will auto-detect if not provided
        
    Returns:
        str: Stock code with market suffix
        
    Examples:
        >>> add_market_suffix("00700", "HK")
        '00700.HK'
        >>> add_market_suffix("600519", "CN")
        '600519.SH'
        >>> add_market_suffix("AAPL", "US")
        'AAPL'
    """
    if not stock_code:
        return stock_code
    
    stock_code = stock_code.strip().upper()
    
    # Auto-detect market type if not provided
    if market_type is None:
        market_type = detect_market_type(stock_code)
    
    # If already has suffix, return as-is
    if '.' in stock_code:
        return stock_code
    
    # Add suffix based on market type
    if market_type == "HK":
        return f"{stock_code}.HK"
    elif market_type == "CN":
        # Default to .SH for CN stocks (could be enhanced to detect SH vs SZ)
        # SH: 600xxx, 601xxx, 603xxx, 688xxx (科创板)
        # SZ: 000xxx, 001xxx, 002xxx, 003xxx, 300xxx (创业板)
        base_code = stock_code.split('.')[0]
        if base_code.isdigit() and len(base_code) == 6:
            first_digit = base_code[0]
            if first_digit in ['6']:
                return f"{stock_code}.SH"
            elif first_digit in ['0', '3']:
                return f"{stock_code}.SZ"
        return f"{stock_code}.SH"  # Default to SH
    
    # US stocks don't need suffix
    return stock_code
