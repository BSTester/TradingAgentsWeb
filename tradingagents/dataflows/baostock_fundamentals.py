"""
BaoStock财务数据获取模块
提供财务报表和基本面数据的获取功能
"""
from typing import Annotated
from datetime import datetime
import pandas as pd
from .baostock_common import (
    check_baostock_availability, validate_market_support, format_symbol_for_baostock,
    handle_baostock_exception, log_operation, BaoStockSession, bs
)


def get_financial_data(
    symbol: Annotated[str, "ticker symbol of the company"],
    year: Annotated[int, "Year for financial data"] = None,
    quarter: Annotated[int, "Quarter (1-4) for financial data"] = None
) -> str:
    """
    获取综合财务数据
    
    Args:
        symbol: 股票代码
        year: 年份
        quarter: 季度 (1-4)
        
    Returns:
        str: CSV格式的财务数据
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "financial data retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(symbol, market)
        
        # 如果没有指定年份和季度，使用最近的数据
        if year is None:
            year = datetime.now().year
        if quarter is None:
            quarter = 4  # 默认年报
        
        log_operation("get_financial_data", symbol, market, "ATTEMPT")
        
        with BaoStockSession():
            results = {}
            
            # 获取各类财务数据
            financial_queries = [
                ('profit', lambda: bs.query_profit_data(code=formatted_symbol, year=year, quarter=quarter)),
                ('operation', lambda: bs.query_operation_data(code=formatted_symbol, year=year, quarter=quarter)),
                ('growth', lambda: bs.query_growth_data(code=formatted_symbol, year=year, quarter=quarter)),
                ('balance', lambda: bs.query_balance_data(code=formatted_symbol, year=year, quarter=quarter)),
                ('cash_flow', lambda: bs.query_cash_flow_data(code=formatted_symbol, year=year, quarter=quarter))
            ]
            
            for name, query_func in financial_queries:
                try:
                    rs = query_func()
                    if rs.error_code == '0':
                        data_list = []
                        while (rs.error_code == '0') & rs.next():
                            data_list.append(rs.get_row_data())
                        
                        if data_list:
                            columns = rs.fields
                            df = pd.DataFrame(data_list, columns=columns)
                            results[name] = df
                            print(f"Successfully retrieved {name} data: {len(df)} records")
                        else:
                            print(f"No {name} data available")
                    else:
                        print(f"Failed to retrieve {name} data: {rs.error_msg}")
                except Exception as e:
                    print(f"Error retrieving {name} data: {e}")
        
        if not results:
            log_operation("get_financial_data", symbol, market, "FAILED")
            return f"No financial data found for symbol '{symbol}' for {year}Q{quarter}"
        
        # 合并所有财务数据
        combined_csv = ""
        for name, df in results.items():
            combined_csv += f"\\n## {name.upper()} DATA ##\\n"
            combined_csv += df.to_csv(index=False)
            combined_csv += "\\n"
        
        # 构建头部信息
        header_lines = [
            f"# Financial data for {symbol} ({market_info['market_name']}) - {year}Q{quarter}",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Data types: {', '.join(results.keys())}",
            f"# Total data sources: {len(results)}",
            f"# Data source: BaoStock",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\\n'.join(header_lines) + '\\n\\n'
        
        log_operation("get_financial_data", symbol, market, "SUCCESS")
        return header + combined_csv
        
    except Exception as e:
        log_operation("get_financial_data", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving financial data", symbol)


def get_balance_sheet(
    symbol: Annotated[str, "ticker symbol of the company"],
    year: Annotated[int, "Year for financial data"] = None,
    quarter: Annotated[int, "Quarter (1-4) for financial data"] = None
) -> str:
    """
    获取资产负债表数据（偿债能力数据）
    
    Args:
        symbol: 股票代码
        year: 年份
        quarter: 季度
        
    Returns:
        str: CSV格式的资产负债表数据
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "balance sheet retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(symbol, market)
        
        # 如果没有指定年份和季度，使用最近的数据
        if year is None:
            year = datetime.now().year
        if quarter is None:
            quarter = 4  # 默认年报
        
        log_operation("get_balance_sheet", symbol, market, "ATTEMPT")
        
        with BaoStockSession():
            # 获取季频偿债能力（包含资产负债表相关数据）
            rs = bs.query_balance_data(code=formatted_symbol, year=year, quarter=quarter)
            
            if rs.error_code != '0':
                log_operation("get_balance_sheet", symbol, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_balance_sheet", symbol, market, "FAILED")
                return f"No balance sheet data found for symbol '{symbol}' for {year}Q{quarter}"
            
            # 创建DataFrame
            columns = rs.fields
            data = pd.DataFrame(data_list, columns=columns)
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Balance Sheet data for {symbol} ({market_info['market_name']}) - {year}Q{quarter}",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Total records: {len(data)}",
            f"# Data source: BaoStock (Balance/Debt Analysis)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\\n'.join(header_lines) + '\\n\\n'
        
        log_operation("get_balance_sheet", symbol, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_balance_sheet", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving balance sheet", symbol)


def get_income_statement(
    symbol: Annotated[str, "ticker symbol of the company"],
    year: Annotated[int, "Year for financial data"] = None,
    quarter: Annotated[int, "Quarter (1-4) for financial data"] = None
) -> str:
    """
    获取利润表数据（盈利能力数据）
    
    Args:
        symbol: 股票代码
        year: 年份
        quarter: 季度
        
    Returns:
        str: CSV格式的利润表数据
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "income statement retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(symbol, market)
        
        # 如果没有指定年份和季度，使用最近的数据
        if year is None:
            year = datetime.now().year
        if quarter is None:
            quarter = 4  # 默认年报
        
        log_operation("get_income_statement", symbol, market, "ATTEMPT")
        
        with BaoStockSession():
            # 获取季频盈利能力
            rs = bs.query_profit_data(code=formatted_symbol, year=year, quarter=quarter)
            
            if rs.error_code != '0':
                log_operation("get_income_statement", symbol, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_income_statement", symbol, market, "FAILED")
                return f"No income statement data found for symbol '{symbol}' for {year}Q{quarter}"
            
            # 创建DataFrame
            columns = rs.fields
            data = pd.DataFrame(data_list, columns=columns)
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Income Statement data for {symbol} ({market_info['market_name']}) - {year}Q{quarter}",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Total records: {len(data)}",
            f"# Data source: BaoStock (Profit Analysis)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\\n'.join(header_lines) + '\\n\\n'
        
        log_operation("get_income_statement", symbol, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_income_statement", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving income statement", symbol)


def get_cashflow(
    symbol: Annotated[str, "ticker symbol of the company"],
    year: Annotated[int, "Year for financial data"] = None,
    quarter: Annotated[int, "Quarter (1-4) for financial data"] = None
) -> str:
    """
    获取现金流量表数据
    
    Args:
        symbol: 股票代码
        year: 年份
        quarter: 季度
        
    Returns:
        str: CSV格式的现金流量表数据
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "cashflow retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(symbol, market)
        
        # 如果没有指定年份和季度，使用最近的数据
        if year is None:
            year = datetime.now().year
        if quarter is None:
            quarter = 4  # 默认年报
        
        log_operation("get_cashflow", symbol, market, "ATTEMPT")
        
        with BaoStockSession():
            # 获取季频现金流量
            rs = bs.query_cash_flow_data(code=formatted_symbol, year=year, quarter=quarter)
            
            if rs.error_code != '0':
                log_operation("get_cashflow", symbol, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_cashflow", symbol, market, "FAILED")
                return f"No cashflow data found for symbol '{symbol}' for {year}Q{quarter}"
            
            # 创建DataFrame
            columns = rs.fields
            data = pd.DataFrame(data_list, columns=columns)
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Cash Flow Statement data for {symbol} ({market_info['market_name']}) - {year}Q{quarter}",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Total records: {len(data)}",
            f"# Data source: BaoStock (Cash Flow Analysis)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\\n'.join(header_lines) + '\\n\\n'
        
        log_operation("get_cashflow", symbol, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_cashflow", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving cashflow", symbol)


def get_fundamentals(
    symbol: Annotated[str, "ticker symbol of the company"],
    year: Annotated[int, "Year for financial data"] = None,
    quarter: Annotated[int, "Quarter (1-4) for financial data"] = None
) -> str:
    """
    获取基本面数据（营运能力和成长能力数据）
    
    Args:
        symbol: 股票代码
        year: 年份
        quarter: 季度
        
    Returns:
        str: CSV格式的基本面数据
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "fundamentals retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(symbol, market)
        
        # 如果没有指定年份和季度，使用最近的数据
        if year is None:
            year = datetime.now().year
        if quarter is None:
            quarter = 4  # 默认年报
        
        log_operation("get_fundamentals", symbol, market, "ATTEMPT")
        
        with BaoStockSession():
            results = {}
            
            # 获取营运能力数据
            try:
                rs_operation = bs.query_operation_data(code=formatted_symbol, year=year, quarter=quarter)
                if rs_operation.error_code == '0':
                    data_list = []
                    while (rs_operation.error_code == '0') & rs_operation.next():
                        data_list.append(rs_operation.get_row_data())
                    
                    if data_list:
                        columns = rs_operation.fields
                        results['operation'] = pd.DataFrame(data_list, columns=columns)
            except Exception as e:
                print(f"Failed to retrieve operation data: {e}")
            
            # 获取成长能力数据
            try:
                rs_growth = bs.query_growth_data(code=formatted_symbol, year=year, quarter=quarter)
                if rs_growth.error_code == '0':
                    data_list = []
                    while (rs_growth.error_code == '0') & rs_growth.next():
                        data_list.append(rs_growth.get_row_data())
                    
                    if data_list:
                        columns = rs_growth.fields
                        results['growth'] = pd.DataFrame(data_list, columns=columns)
            except Exception as e:
                print(f"Failed to retrieve growth data: {e}")
        
        if not results:
            log_operation("get_fundamentals", symbol, market, "FAILED")
            return f"No fundamentals data found for symbol '{symbol}' for {year}Q{quarter}"
        
        # 合并所有基本面数据
        combined_csv = ""
        for name, df in results.items():
            combined_csv += f"\\n## {name.upper()} DATA ##\\n"
            combined_csv += df.to_csv(index=False)
            combined_csv += "\\n"
        
        # 构建头部信息
        header_lines = [
            f"# Fundamentals data for {symbol} ({market_info['market_name']}) - {year}Q{quarter}",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Data types: {', '.join(results.keys())}",
            f"# Total data sources: {len(results)}",
            f"# Data source: BaoStock (Operation & Growth Analysis)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\\n'.join(header_lines) + '\\n\\n'
        
        log_operation("get_fundamentals", symbol, market, "SUCCESS")
        return header + combined_csv
        
    except Exception as e:
        log_operation("get_fundamentals", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving fundamentals", symbol)