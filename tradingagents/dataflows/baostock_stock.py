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


def get_stock_data(
    symbol: Annotated[str, "ticker symbol of the company"],
    start_date: Annotated[str, "Start date in yyyy-mm-dd format"],
    end_date: Annotated[str, "End date in yyyy-mm-dd format"],
) -> str:
    """
    获取A股历史数据
    
    Args:
        symbol: 股票代码
        start_date: 开始日期 (YYYY-MM-DD)
        end_date: 结束日期 (YYYY-MM-DD)
        
    Returns:
        str: CSV格式的股票历史数据
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
        
        log_operation("get_stock_data", symbol, market, "ATTEMPT")
        
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
                log_operation("get_stock_data", symbol, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_stock_data", symbol, market, "FAILED")
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
        
        log_operation("get_stock_data", symbol, market, "SUCCESS")
        return process_dataframe_for_output(data, symbol, market_info, "Stock", additional_info)
        
    except Exception as e:
        log_operation("get_stock_data", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving stock data", symbol)


def get_stock_info(
    symbol: Annotated[str, "ticker symbol of the company"]
) -> str:
    """
    获取股票基本信息
    
    Args:
        symbol: 股票代码
        
    Returns:
        str: CSV格式的股票基本信息
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "company info retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(symbol, market)
        
        log_operation("get_stock_info", symbol, market, "ATTEMPT")
        
        with BaoStockSession():
            # 获取股票基本信息
            rs = bs.query_stock_basic(code=formatted_symbol)
            
            if rs.error_code != '0':
                log_operation("get_stock_info", symbol, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_stock_info", symbol, market, "FAILED")
                return f"No company info found for symbol '{symbol}'"
            
            # 创建DataFrame
            columns = rs.fields
            data = pd.DataFrame(data_list, columns=columns)
        
        # 生成标准化输出
        additional_info = {
            "Formatted symbol": formatted_symbol
        }
        
        log_operation("get_stock_info", symbol, market, "SUCCESS")
        return process_dataframe_for_output(data, symbol, market_info, "Company Info", additional_info)
        
    except Exception as e:
        log_operation("get_stock_info", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving company info", symbol)


def get_realtime_data(
    symbol: Annotated[str, "ticker symbol of the company"]
) -> str:
    """
    获取实时数据（BaoStock不支持实时数据，返回最新交易日数据）
    
    Args:
        symbol: 股票代码
        
    Returns:
        str: 说明信息
    """
    return f"Note: BaoStock does not provide real-time data. Please use the latest trading day data from get_stock_data instead."


def get_dividend_data(
    symbol: Annotated[str, "ticker symbol of the company"],
    year: Annotated[str, "Year for dividend data"] = None,
    year_type: Annotated[str, "Year type: report or operate"] = "report"
) -> str:
    """
    获取除权除息数据
    
    Args:
        symbol: 股票代码
        year: 年份 (字符串格式，如"2024")
        year_type: 年份类别 ("report":预案公告年份, "operate":除权除息年份)
        
    Returns:
        str: CSV格式的除权除息数据
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "dividend data retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(symbol, market)
        
        # 如果没有指定年份，使用当前年份
        if year is None:
            year = str(datetime.now().year)
        
        log_operation("get_dividend_data", symbol, market, "ATTEMPT")
        
        with BaoStockSession():
            # 获取除权除息信息 - 使用正确的官方参数
            rs = bs.query_dividend_data(code=formatted_symbol, year=year, yearType=year_type)
            
            if rs.error_code != '0':
                log_operation("get_dividend_data", symbol, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_dividend_data", symbol, market, "FAILED")
                return f"No dividend data found for symbol '{symbol}' for year {year}"
            
            # 创建DataFrame
            columns = rs.fields
            data = pd.DataFrame(data_list, columns=columns)
        
        # 生成标准化输出
        additional_info = {
            "Formatted symbol": formatted_symbol,
            "Year": year,
            "Year type": year_type
        }
        
        log_operation("get_dividend_data", symbol, market, "SUCCESS")
        return process_dataframe_for_output(data, symbol, market_info, "Dividend", additional_info)
        
    except Exception as e:
        log_operation("get_dividend_data", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving dividend data", symbol)