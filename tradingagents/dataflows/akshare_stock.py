"""
AKShare股票数据获取模块
提供股票历史数据和实时数据的获取功能
"""
from typing import Annotated
from .akshare_common import (
    check_akshare_availability, validate_market_support, format_symbol_for_market,
    validate_date_format, format_date_for_akshare, standardize_column_names,
    process_dataframe_for_output, handle_akshare_exception, log_operation, ak
)

from datetime import datetime
try:
    import pandas as pd
except Exception:
    pd = None  # type: ignore


def get_stock(
    symbol: str,
    start_date: str,
    end_date: str
) -> str:
    """
    Returns raw daily OHLCV values, adjusted close values, and historical split/dividend events
    filtered to the specified date range.

    Args:
        symbol: The name of the equity. For example: symbol=IBM
        start_date: Start date in yyyy-mm-dd format
        end_date: End date in yyyy-mm-dd format

    Returns:
        CSV string containing the daily adjusted time series data filtered to the date range.
    """
    try:
        check_akshare_availability()
        
        # 验证日期格式
        validate_date_format(start_date)
        validate_date_format(end_date)
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "stock data retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        
        # 格式化日期
        formatted_start = format_date_for_akshare(start_date, market)
        formatted_end = format_date_for_akshare(end_date, market)
        
        log_operation("get_stock", symbol, market, "ATTEMPT")
        
        # 根据市场选择对应的AKShare接口
        data = None
        if market == 'A_STOCK':
            # A股使用纯数字代码
            clean_symbol = formatted_symbol.replace('SZ', '').replace('SH', '')
            data = ak.stock_zh_a_hist(
                symbol=clean_symbol,
                period="daily",
                start_date=formatted_start,
                end_date=formatted_end,
                adjust="qfq"  # 前复权
            )
        elif market == 'HK_STOCK':
            data = ak.stock_hk_hist(
                symbol=formatted_symbol,
                period="daily",
                start_date=formatted_start,
                end_date=formatted_end,
                adjust="qfq"
            )
        elif market == 'US_STOCK':
            # 使用 AKShare 的 stock_us_daily 接口，支持标准美股代码
            try:
                # 获取全部历史数据
                data = ak.stock_us_daily(symbol=formatted_symbol, adjust="qfq")
                
                if data is not None and not data.empty:
                    # 处理日期列和索引
                    if pd is not None:
                        data['date'] = pd.to_datetime(data['date'])
                        data.set_index('date', inplace=True)
                        
                        # 按日期范围筛选数据
                        start_dt = pd.to_datetime(start_date)
                        end_dt = pd.to_datetime(end_date)
                        data = data[(data.index >= start_dt) & (data.index <= end_dt)]
                    else:
                        pass
                    
            except Exception as e:
                # AKShare美股接口失败，抛出异常以触发回退
                raise Exception(f"AKShare US stock interface failed for {symbol}: {str(e)}")
        
        if data is None or data.empty:
            log_operation("get_stock", symbol, market, "FAILED")
            error_msg = f"No data found for symbol '{symbol}' between {start_date} and {end_date}"
            # 对于美股，抛出异常以触发回退到其他数据源
            if market == 'US_STOCK':
                raise Exception(error_msg)
            return error_msg
        
        # 标准化列名
        data = standardize_column_names(data, market)
        
        # 生成标准化输出
        additional_info = {
            "Formatted symbol": formatted_symbol,
            "Date range": f"{start_date} to {end_date}"
        }
        
        log_operation("get_stock", symbol, market, "SUCCESS")
        return process_dataframe_for_output(data, symbol, market_info, "Stock", additional_info)
        
    except Exception as e:
        log_operation("get_stock", symbol, (market if ('market' in locals() and market is not None) else "UNKNOWN"), "FAILED")
        # 对于美股，直接抛出异常以触发回退
        if 'market' in locals() and market == 'US_STOCK':
            raise e
        return handle_akshare_exception(e, "retrieving stock data", symbol)