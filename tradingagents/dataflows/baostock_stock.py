"""
BaoStock股票数据获取模块
提供股票历史数据和基本信息的获取功能
"""
from typing import Annotated
from datetime import datetime
import pandas as pd
from .baostock_common import (
    check_baostock_availability, validate_market_support, format_symbol_for_baostock,
    validate_date_format, standardize_column_names, process_dataframe_for_output,
    handle_baostock_exception, log_operation, BaoStockSession, bs
)


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
        check_baostock_availability()
        
        # 验证日期格式
        validate_date_format(start_date)
        validate_date_format(end_date)
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "stock data retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(symbol, market)
        
        log_operation("get_stock", symbol, market, "ATTEMPT")
        
        with BaoStockSession():
            # 获取日K线数据
            rs = bs.query_history_k_data_plus(
                formatted_symbol,
                "date,code,open,high,low,close,preclose,volume,amount,adjustflag,turn,tradestatus,pctChg,isST",
                start_date=start_date,
                end_date=end_date,
                frequency="d",  # 日线
                adjustflag="3"  # 后复权
            )
            
            if rs.error_code != '0':
                log_operation("get_stock", symbol, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_stock", symbol, market, "FAILED")
                return f"No data found for symbol '{symbol}' between {start_date} and {end_date}"
            
            # 创建DataFrame
            columns = rs.fields
            data = pd.DataFrame(data_list, columns=columns)
            
            # 设置日期为索引
            if not data.empty:
                data['date'] = pd.to_datetime(data['date'])
                data.set_index('date', inplace=True)
                
                # 标准化列名
                data = standardize_column_names(data, "stock")
        
        # 生成标准化输出
        additional_info = {
            "Formatted symbol": formatted_symbol,
            "Adjust flag": "3 (后复权)",
            "Date range": f"{start_date} to {end_date}"
        }
        
        log_operation("get_stock", symbol, market, "SUCCESS")
        return process_dataframe_for_output(data, symbol, market_info, "Stock", additional_info)
        
    except Exception as e:
        log_operation("get_stock", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving stock data", symbol)