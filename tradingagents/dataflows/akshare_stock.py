"""
AkShare Stock Data
Get historical stock price data (OHLCV)
"""

import logging
import os
import pandas as pd
from datetime import datetime
from .akshare_common import _identify_market, MARKET_PATTERNS, get_akshare


def _convert_date_format(date_str: str, target_format: str = "YYYYMMDD") -> str:
    """Convert date format between YYYY-MM-DD and YYYYMMDD"""
    if not date_str:
        return ""
    
    try:
        if "-" in date_str:
            if target_format == "YYYYMMDD":
                return date_str.replace("-", "")
            return date_str
        else:
            if target_format == "YYYY-MM-DD":
                return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            return date_str
    except Exception:
        return date_str


def get_stock(symbol: str, start_date: str, end_date: str) -> str:
    """
    Get stock price data with multi-source fallback strategy
    
    Fallback priority by market:
    - A股: stock_zh_a_hist → stock_zh_a_hist_tx
    - 美股: stock_us_daily
    - 港股: stock_hk_hist → stock_hk_daily
    
    Args:
        symbol: Stock symbol (e.g., "600519", "AAPL", "00700")
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    
    Returns:
        CSV string containing OHLCV data with standardized column names
    """
    ak = get_akshare()
    if not ak:
        return "Error: akshare not installed"
    
    market = _identify_market(symbol)
    logging.info(f"Identified market for {symbol}: {market}")
    
    start_date_fmt = _convert_date_format(start_date, "YYYYMMDD")
    end_date_fmt = _convert_date_format(end_date, "YYYYMMDD")
    
    # Normalize symbol
    symbol_for_ak = symbol
    if market == 'HK_STOCK':
        symbol_upper = symbol.upper()
        if symbol_upper.endswith('.HK'):
            num = symbol_upper[:-3]
            if num.isdigit():
                symbol_for_ak = num.zfill(5)
        elif symbol.isdigit():
            symbol_for_ak = symbol.zfill(5)
    
    data = None
    source_used = ""
    
    # A股
    if market == 'A_STOCK':
        try:
            logging.info(f"Trying stock_zh_a_hist for {symbol}")
            data = ak.stock_zh_a_hist(
                symbol=symbol,
                period="daily",
                start_date=start_date_fmt,
                end_date=end_date_fmt,
                adjust="qfq"
            )
            if data is not None and not data.empty:
                source_used = "stock_zh_a_hist (EastMoney)"
        except Exception as e:
            logging.warning(f"stock_zh_a_hist failed: {e}")
        
        if data is None or data.empty:
            try:
                logging.info(f"Falling back to stock_zh_a_hist_tx")
                tx_symbol = symbol
                if symbol.startswith(('60', '68')):
                    tx_symbol = f"sh{symbol}"
                elif symbol.startswith(('00', '30')):
                    tx_symbol = f"sz{symbol}"
                elif symbol.startswith(('83', '87')):
                    tx_symbol = f"bj{symbol}"
                
                data = ak.stock_zh_a_hist_tx(
                    symbol=tx_symbol,
                    start_date=start_date_fmt,
                    end_date=end_date_fmt,
                    adjust="qfq"
                )
                if data is not None and not data.empty:
                    source_used = "stock_zh_a_hist_tx (Tencent)"
            except Exception as e:
                logging.warning(f"stock_zh_a_hist_tx failed: {e}")
    
    # 美股
    elif market == 'US_STOCK':
        try:
            logging.info(f"Trying stock_us_daily for {symbol}")
            data = ak.stock_us_daily(symbol=symbol.upper(), adjust="qfq")
            if data is not None and not data.empty:
                source_used = "stock_us_daily (Sina)"
        except Exception as e:
            logging.warning(f"stock_us_daily failed: {e}")
    
    # 港股
    elif market == 'HK_STOCK':
        try:
            logging.info(f"Trying stock_hk_hist for {symbol_for_ak}")
            data = ak.stock_hk_hist(
                symbol=symbol_for_ak,
                period="daily",
                start_date=start_date_fmt,
                end_date=end_date_fmt,
                adjust="qfq"
            )
            if data is not None and not data.empty:
                source_used = "stock_hk_hist (EastMoney)"
        except Exception as e:
            logging.warning(f"stock_hk_hist failed: {e}")
        
        if data is None or data.empty:
            try:
                logging.info(f"Falling back to stock_hk_daily")
                data = ak.stock_hk_daily(symbol=symbol_for_ak, adjust="qfq")
                if data is not None and not data.empty:
                    source_used = "stock_hk_daily (Sina)"
            except Exception as e:
                logging.warning(f"stock_hk_daily failed: {e}")
    
    if data is None or not isinstance(data, pd.DataFrame) or data.empty:
        return f"No data found for {symbol} between {start_date} and {end_date}"
    
    # Standardize columns
    if 'Date' not in data.columns and data.index.name == 'Date':
        data = data.reset_index()
    
    data = data.rename(columns={
        'date': '日期', 'Date': '日期',
        'open': '开盘', 'Open': '开盘',
        'close': '收盘', 'Close': '收盘',
        'high': '最高', 'High': '最高',
        'low': '最低', 'Low': '最低',
        'volume': '成交量', 'Volume': '成交量'
    })
    
    column_mapping = {
        '日期': 'Date',
        '开盘': 'Open',
        '收盘': 'Close',
        '最高': 'High',
        '最低': 'Low',
        '成交量': 'Volume',
        '成交额': 'Amount',
        '振幅': 'Amplitude',
        '涨跌幅': 'Change_Pct',
        '涨跌额': 'Change_Amount',
        '换手率': 'Turnover'
    }
    
    data = data.rename(columns=column_mapping)
    
    # Filter by date
    if 'Date' in data.columns:
        data['Date'] = pd.to_datetime(data['Date'], errors='coerce')
        start_dt = pd.to_datetime(start_date, errors='coerce')
        end_dt = pd.to_datetime(end_date, errors='coerce')
        data = data.dropna(subset=['Date'])
        
        if pd.notna(start_dt) and pd.notna(end_dt):
            data = data[(data['Date'] >= start_dt) & (data['Date'] <= end_dt)]
        
        data = data.sort_values('Date')
    
    csv_string = data.to_csv(index=False)
    
    header = f"# Stock data for {symbol} from {start_date} to {end_date}\n"
    header += f"# Data source: AKShare - {source_used}\n"
    header += f"# Market: {MARKET_PATTERNS[market]['description']}\n"
    header += f"# Total records: {len(data)}\n"
    header += f"# Retrieved: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    
    logging.info(f"Returned {len(data)} records for {symbol} from {source_used}")
    return header + csv_string


def _normalize_xueqiu_symbol(symbol: str, market: str) -> str:
    """
    Normalize stock symbol to XueQiu format
    
    XueQiu format requirements:
    - A-shares: Add exchange prefix (SH/SZ/BJ) + 6-digit code (e.g., "SH600000")
    - US stocks: Use uppercase ticker as-is (e.g., "AAPL")
    - HK stocks: Use 5-digit code without .HK suffix (e.g., "00700")
    
    Args:
        symbol: Original stock symbol
        market: Market type from _identify_market()
        
    Returns:
        Normalized symbol for XueQiu API
        
    Examples:
        >>> _normalize_xueqiu_symbol("600000", "A_STOCK")
        'SH600000'
        >>> _normalize_xueqiu_symbol("AAPL", "US_STOCK")
        'AAPL'
        >>> _normalize_xueqiu_symbol("00700.HK", "HK_STOCK")
        '00700'
    """
    if market == 'A_STOCK':
        # Remove any existing prefix
        symbol_clean = symbol.upper()
        if symbol_clean.startswith(('SH', 'SZ', 'BJ')):
            return symbol_clean
        
        # Remove market suffix if present
        if '.' in symbol_clean:
            symbol_clean = symbol_clean.split('.')[0]
        
        # Add appropriate prefix based on code pattern
        if symbol_clean.startswith(('60', '68')):  # Shanghai main board / STAR
            return f"SH{symbol_clean}"
        elif symbol_clean.startswith(('00', '30')):  # Shenzhen main board / ChiNext
            return f"SZ{symbol_clean}"
        elif symbol_clean.startswith(('83', '87')):  # Beijing Stock Exchange
            return f"BJ{symbol_clean}"
        else:
            # Default to Shanghai
            return f"SH{symbol_clean}"
    
    elif market == 'US_STOCK':
        # US stocks: just uppercase
        return symbol.upper()
    
    elif market == 'HK_STOCK':
        # Remove .HK suffix if present
        symbol_clean = symbol.upper()
        if symbol_clean.endswith('.HK'):
            symbol_clean = symbol_clean[:-3]
        
        # Zero-pad to 5 digits if it's numeric
        if symbol_clean.isdigit():
            return symbol_clean.zfill(5)
        return symbol_clean
    
    # Unknown market, return as-is
    return symbol


def get_stock_realtime_quote(symbol: str) -> str:
    """
    Get real-time stock quote from XueQiu (雪球) interface
    
    Supports A-shares, US stocks, and Hong Kong stocks through a unified interface.
    
    Args:
        symbol: Stock symbol (e.g., "600519", "AAPL", "00700")
    
    Returns:
        Formatted string containing real-time quote data with metadata header
        
    Example:
        >>> quote = get_stock_realtime_quote("600000")
        >>> print(quote)
        # Real-time quote for 600000
        # Data source: AKShare - XueQiu (雪球)
        # Market: A股市场 (深圳/上海/科创板/创业板/北交所)
        # Retrieved: 2025-10-31 15:30:00
        
        Symbol: SH600000
        Name: 浦发银行
        Current_Price: 11.49
        Open: 11.72
        High: 11.74
        Low: 11.49
        Previous_Close: 11.64
        Volume: 143534203
        Amount: 1657883721.0
        Change: -0.15
        Change_Percent: -1.29%
        ...
    
    Note:
        Requires XUEQIU_TOKEN environment variable to be set.
        Get token from: https://xueqiu.com (xq_a_token cookie)
        See docs/XUEQIU_TOKEN_SETUP.md for setup instructions.
    """
    # Get akshare instance
    ak = get_akshare()
    if not ak:
        return "Error: akshare not installed"
    
    # Get token from environment variable
    token = os.getenv('XUEQIU_TOKEN')
    if token:
        logging.info("Using XUEQIU_TOKEN from environment variable")
    
    # Identify market
    market = _identify_market(symbol)
    logging.info(f"Identified market for {symbol}: {market}")
    
    if market == 'UNKNOWN':
        logging.warning(f"Unable to identify market for symbol: {symbol}")
        return f"Error: Unable to identify market for symbol {symbol}"

    
    # Normalize symbol for XueQiu API
    normalized_symbol = _normalize_xueqiu_symbol(symbol, market)
    
    # Call XueQiu API
    data = None
    try:
        logging.info(f"Trying stock_individual_spot_xq for {normalized_symbol}")
        data = ak.stock_individual_spot_xq(symbol=normalized_symbol, token=token)
    except Exception as e:
        logging.warning(f"stock_individual_spot_xq failed for {symbol}: {e}")
        return f"Error retrieving real-time quote for {symbol}: {str(e)}"

    
    # Validate response
    if data is None or not isinstance(data, pd.DataFrame) or data.empty:
        logging.warning(f"Empty response for {symbol}")
        return f"No real-time data available for {symbol}"
    
    # Convert DataFrame to dictionary (item -> value mapping)
    data_dict = dict(zip(data['item'], data['value']))
    logging.info(f"Successfully retrieved real-time quote for {symbol}")

    
    # Field mapping: Chinese -> English
    field_mapping = {
        '代码': 'Symbol',
        '名称': 'Name',
        '现价': 'Current_Price',
        '今开': 'Open',
        '最高': 'High',
        '最低': 'Low',
        '昨收': 'Previous_Close',
        '成交量': 'Volume',
        '成交额': 'Amount',
        '涨跌': 'Change',
        '涨幅': 'Change_Percent',
        '时间': 'Timestamp',
        '市盈率(TTM)': 'PE_Ratio_TTM',
        '市盈率(动)': 'PE_Ratio_Dynamic',
        '市盈率(静)': 'PE_Ratio_Static',
        '市净率': 'PB_Ratio',
        '总市值': 'Market_Cap',
        '资产净值/总市值': 'Total_Market_Cap',
        '流通值': 'Circulating_Market_Cap',
        '流通股': 'Circulating_Shares',
        '基金份额/总股本': 'Total_Shares',
        '周转率': 'Turnover_Rate',
        '换手率': 'Turnover_Rate',
        '振幅': 'Amplitude',
        '52周最高': '52_Week_High',
        '52周最低': '52_Week_Low',
        '每股收益': 'EPS',
        '每股净资产': 'Net_Asset_Per_Share',
        '股息(TTM)': 'Dividend_TTM',
        '股息率(TTM)': 'Dividend_Yield_TTM',
        '涨停': 'Limit_Up',
        '跌停': 'Limit_Down',
        '均价': 'Average_Price',
        '今年以来涨幅': 'YTD_Change',
        '货币': 'Currency',
        '交易所': 'Exchange',
        '最小交易单位': 'Min_Trade_Unit',
        '发行日期': 'Issue_Date',
        '净资产中的商誉': 'Goodwill_In_Net_Assets'
    }
    
    # Extract values with fallback to N/A
    extracted_data = {}
    for chinese_key, english_key in field_mapping.items():
        value = data_dict.get(chinese_key, 'N/A')
        
        # Format percentages
        if english_key in ['Change_Percent', 'Turnover_Rate', 'Dividend_Yield_TTM', 'YTD_Change']:
            if value != 'N/A' and value is not None:
                try:
                    extracted_data[english_key] = f"{value}%"
                except:
                    extracted_data[english_key] = str(value)
            else:
                extracted_data[english_key] = 'N/A'
        else:
            extracted_data[english_key] = str(value) if value is not None else 'N/A'

    
    # Format output string
    header = f"# Real-time quote for {symbol}\n"
    header += f"# Data source: AKShare - XueQiu (雪球)\n"
    header += f"# Market: {MARKET_PATTERNS[market]['description']}\n"
    header += f"# Retrieved: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    
    # Build data section with key-value pairs in logical order
    output_lines = []
    
    # Essential trading data first
    essential_fields = [
        'Symbol', 'Name', 'Current_Price', 'Open', 'High', 'Low', 
        'Previous_Close', 'Volume', 'Amount', 'Change', 'Change_Percent'
    ]
    
    for field in essential_fields:
        if field in extracted_data:
            output_lines.append(f"{field}: {extracted_data[field]}")
    
    # Additional metrics
    additional_fields = [
        'Timestamp', 'Average_Price', 'Amplitude', 
        'PE_Ratio_TTM', 'PE_Ratio_Dynamic', 'PE_Ratio_Static', 'PB_Ratio',
        'Market_Cap', 'Total_Market_Cap', 'Circulating_Market_Cap',
        'Total_Shares', 'Circulating_Shares', 'Turnover_Rate',
        'EPS', 'Net_Asset_Per_Share', 'Dividend_TTM', 'Dividend_Yield_TTM',
        '52_Week_High', '52_Week_Low', 'YTD_Change',
        'Limit_Up', 'Limit_Down', 'Currency', 'Exchange',
        'Min_Trade_Unit', 'Issue_Date', 'Goodwill_In_Net_Assets'
    ]
    
    for field in additional_fields:
        if field in extracted_data and extracted_data[field] != 'N/A':
            output_lines.append(f"{field}: {extracted_data[field]}")
    
    return header + '\n'.join(output_lines)
