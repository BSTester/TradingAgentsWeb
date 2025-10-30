"""
AkShare Stock Data
Get historical stock price data (OHLCV)
"""

import logging
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
