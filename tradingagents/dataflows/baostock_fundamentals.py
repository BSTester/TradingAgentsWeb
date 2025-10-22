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


def _parse_year_parameter(year_input):
    """
    解析年份参数，支持多种格式
    
    Args:
        year_input: 年份输入，可以是整数、字符串数字或日期字符串
        
    Returns:
        int: 解析后的年份，如果解析失败则返回当前年份
    """
    if year_input is None:
        return datetime.now().year
    
    # 如果已经是整数，直接返回
    if isinstance(year_input, int):
        return year_input
    
    # 转换为字符串处理
    year_str = str(year_input).strip()
    
    # 尝试直接转换为整数
    try:
        return int(year_str)
    except ValueError:
        pass
    
    # 尝试解析日期格式
    date_formats = [
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%Y%m%d',
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d %H:%M:%S'
    ]
    
    for fmt in date_formats:
        try:
            parsed_date = datetime.strptime(year_str, fmt)
            return parsed_date.year
        except ValueError:
            continue
    
    # 如果所有解析都失败，返回当前年份
    print(f"Warning: Unable to parse year from '{year_input}', using current year {datetime.now().year}")
    return datetime.now().year


def get_balance_sheet(ticker: str, freq: str = "quarterly", curr_date: str = None) -> str:
    """
    Retrieve balance sheet data for a given ticker symbol using Alpha Vantage.

    Args:
        ticker (str): Ticker symbol of the company
        freq (str): Reporting frequency: annual/quarterly (default quarterly) - not used for Alpha Vantage
        curr_date (str): Current date you are trading at, yyyy-mm-dd (not used for Alpha Vantage)

    Returns:
        str: Balance sheet data with normalized fields
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(ticker, "balance sheet retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(ticker, market)
        
        # 将 freq 和 curr_date 转换为 year 和 quarter
        year = _parse_year_parameter(curr_date) if curr_date else datetime.now().year
        
        # 根据 freq 确定 quarter
        if freq and freq.lower() in ["annual", "year", "年度"]:
            quarter = 4  # 年报
        else:
            quarter = 4  # 默认季报（最新季度）
        
        log_operation("get_balance_sheet", ticker, market, "ATTEMPT")
        
        with BaoStockSession():
            # 获取季频偿债能力（包含资产负债表相关数据）
            rs = bs.query_balance_data(code=formatted_symbol, year=year, quarter=quarter)
            
            if rs.error_code != '0':
                log_operation("get_balance_sheet", ticker, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_balance_sheet", ticker, market, "FAILED")
                return f"No balance sheet data found for symbol '{ticker}' for {year}Q{quarter}"
            
            # 创建DataFrame
            columns = rs.fields
            data = pd.DataFrame(data_list, columns=columns)
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Balance Sheet data for {ticker} ({market_info['market_name']}) - {year}Q{quarter}",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Total records: {len(data)}",
            f"# Data source: BaoStock (Balance/Debt Analysis)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\\n'.join(header_lines) + '\\n\\n'
        
        log_operation("get_balance_sheet", ticker, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_balance_sheet", ticker, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving balance sheet", ticker)


def get_income_statement(ticker: str, freq: str = "quarterly", curr_date: str = None) -> str:
    """
    Retrieve income statement data for a given ticker symbol using Alpha Vantage.

    Args:
        ticker (str): Ticker symbol of the company
        freq (str): Reporting frequency: annual/quarterly (default quarterly) - not used for Alpha Vantage
        curr_date (str): Current date you are trading at, yyyy-mm-dd (not used for Alpha Vantage)

    Returns:
        str: Income statement data with normalized fields
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(ticker, "income statement retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(ticker, market)
        
        # 将 freq 和 curr_date 转换为 year 和 quarter
        year = _parse_year_parameter(curr_date) if curr_date else datetime.now().year
        
        # 根据 freq 确定 quarter
        if freq and freq.lower() in ["annual", "year", "年度"]:
            quarter = 4  # 年报
        else:
            quarter = 4  # 默认季报（最新季度）
        
        log_operation("get_income_statement", ticker, market, "ATTEMPT")
        
        with BaoStockSession():
            # 获取季频盈利能力
            rs = bs.query_profit_data(code=formatted_symbol, year=year, quarter=quarter)
            
            if rs.error_code != '0':
                log_operation("get_income_statement", ticker, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_income_statement", ticker, market, "FAILED")
                return f"No income statement data found for symbol '{ticker}' for {year}Q{quarter}"
            
            # 创建DataFrame
            columns = rs.fields
            data = pd.DataFrame(data_list, columns=columns)
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Income Statement data for {ticker} ({market_info['market_name']}) - {year}Q{quarter}",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Total records: {len(data)}",
            f"# Data source: BaoStock (Profit Analysis)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\\n'.join(header_lines) + '\\n\\n'
        
        log_operation("get_income_statement", ticker, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_income_statement", ticker, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving income statement", ticker)


def get_cashflow(ticker: str, freq: str = "quarterly", curr_date: str = None) -> str:
    """
    Retrieve cash flow statement data for a given ticker symbol using Alpha Vantage.

    Args:
        ticker (str): Ticker symbol of the company
        freq (str): Reporting frequency: annual/quarterly (default quarterly) - not used for Alpha Vantage
        curr_date (str): Current date you are trading at, yyyy-mm-dd (not used for Alpha Vantage)

    Returns:
        str: Cash flow statement data with normalized fields
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(ticker, "cashflow retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(ticker, market)
        
        # 将 freq 和 curr_date 转换为 year 和 quarter
        year = _parse_year_parameter(curr_date) if curr_date else datetime.now().year
        
        # 根据 freq 确定 quarter
        if freq and freq.lower() in ["annual", "year", "年度"]:
            quarter = 4  # 年报
        else:
            quarter = 4  # 默认季报（最新季度）
        
        log_operation("get_cashflow", ticker, market, "ATTEMPT")
        
        with BaoStockSession():
            # 获取季频现金流量
            rs = bs.query_cash_flow_data(code=formatted_symbol, year=year, quarter=quarter)
            
            if rs.error_code != '0':
                log_operation("get_cashflow", ticker, market, "FAILED")
                return f"Error: BaoStock query failed: {rs.error_msg}"
            
            # 转换为DataFrame
            data_list = []
            while (rs.error_code == '0') & rs.next():
                data_list.append(rs.get_row_data())
            
            if not data_list:
                log_operation("get_cashflow", ticker, market, "FAILED")
                return f"No cashflow data found for symbol '{ticker}' for {year}Q{quarter}"
            
            # 创建DataFrame
            columns = rs.fields
            data = pd.DataFrame(data_list, columns=columns)
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Cash Flow Statement data for {ticker} ({market_info['market_name']}) - {year}Q{quarter}",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Total records: {len(data)}",
            f"# Data source: BaoStock (Cash Flow Analysis)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\\n'.join(header_lines) + '\\n\\n'
        
        log_operation("get_cashflow", ticker, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_cashflow", ticker, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving cashflow", ticker)


def get_fundamentals(ticker: str, curr_date: str = None) -> str:
    """
    Retrieve comprehensive fundamental data for a given ticker symbol using Alpha Vantage.

    Args:
        ticker (str): Ticker symbol of the company
        curr_date (str): Current date you are trading at, yyyy-mm-dd (not used for Alpha Vantage)

    Returns:
        str: Company overview data including financial ratios and key metrics
    """
    try:
        check_baostock_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(ticker, "fundamentals retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_baostock(ticker, market)
        
        # 将 curr_date 转换为 year 和 quarter
        year = _parse_year_parameter(curr_date) if curr_date else datetime.now().year
        quarter = 4  # 默认年报
        
        log_operation("get_fundamentals", ticker, market, "ATTEMPT")
        
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
            log_operation("get_fundamentals", ticker, market, "FAILED")
            return f"No fundamentals data found for symbol '{ticker}' for {year}Q{quarter}"
        
        # 合并所有基本面数据
        combined_csv = ""
        for name, df in results.items():
            combined_csv += f"\\n## {name.upper()} DATA ##\\n"
            combined_csv += df.to_csv(index=False)
            combined_csv += "\\n"
        
        # 构建头部信息
        header_lines = [
            f"# Fundamentals data for {ticker} ({market_info['market_name']}) - {year}Q{quarter}",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Data types: {', '.join(results.keys())}",
            f"# Total data sources: {len(results)}",
            f"# Data source: BaoStock (Operation & Growth Analysis)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\\n'.join(header_lines) + '\\n\\n'
        
        log_operation("get_fundamentals", ticker, market, "SUCCESS")
        return header + combined_csv
        
    except Exception as e:
        log_operation("get_fundamentals", ticker, market if 'market' in locals() else None, "FAILED")
        return handle_baostock_exception(e, "retrieving fundamentals", ticker)