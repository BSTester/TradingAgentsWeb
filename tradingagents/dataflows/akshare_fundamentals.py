"""
AKShare财务数据获取模块
提供财务报表和基本面数据的获取功能
"""
from typing import Annotated
from datetime import datetime
from .akshare_common import (
    check_akshare_availability, validate_market_support, format_symbol_for_market,
    handle_akshare_exception, log_operation, ak
)


def get_balance_sheet(
    symbol: Annotated[str, "ticker symbol of the company"],
    freq: Annotated[str, "frequency"] = "quarterly",
    curr_date: Annotated[str, "current date"] = None
) -> str:
    """
    获取资产负债表数据
    
    Args:
        symbol: 股票代码
        freq: 频率（季度/年度）
        curr_date: 当前日期（未使用，保持接口一致性）
        
    Returns:
        str: CSV格式的资产负债表数据
    """
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "balance sheet retrieval")
        
        if market != 'A_STOCK':
            return f"Financial data is mainly available for A-shares only"
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
        
        log_operation("get_balance_sheet", symbol, market, "ATTEMPT")
        
        # 获取资产负债表数据
        data = ak.stock_balance_sheet_by_report_em(symbol=clean_symbol)
        
        if data.empty:
            log_operation("get_balance_sheet", symbol, market, "FAILED")
            return f"No balance sheet data found for symbol '{symbol}'"
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Balance Sheet for {symbol} ({market_info['market_name']})",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Frequency: {freq}",
            f"# Data source: AKShare",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_balance_sheet", symbol, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_balance_sheet", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_akshare_exception(e, "retrieving balance sheet", symbol)


def get_income_statement(
    symbol: Annotated[str, "ticker symbol of the company"],
    freq: Annotated[str, "frequency"] = "quarterly",
    curr_date: Annotated[str, "current date"] = None
) -> str:
    """
    获取利润表数据
    
    Args:
        symbol: 股票代码
        freq: 频率（季度/年度）
        curr_date: 当前日期（未使用，保持接口一致性）
        
    Returns:
        str: CSV格式的利润表数据
    """
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "income statement retrieval")
        
        if market != 'A_STOCK':
            return f"Financial data is mainly available for A-shares only"
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
        
        log_operation("get_income_statement", symbol, market, "ATTEMPT")
        
        # 获取利润表数据
        data = ak.stock_profit_sheet_by_report_em(symbol=clean_symbol)
        
        if data.empty:
            log_operation("get_income_statement", symbol, market, "FAILED")
            return f"No income statement data found for symbol '{symbol}'"
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Income Statement for {symbol} ({market_info['market_name']})",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Frequency: {freq}",
            f"# Data source: AKShare",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_income_statement", symbol, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_income_statement", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_akshare_exception(e, "retrieving income statement", symbol)


def get_cashflow(
    symbol: Annotated[str, "ticker symbol of the company"],
    freq: Annotated[str, "frequency"] = "quarterly",
    curr_date: Annotated[str, "current date"] = None
) -> str:
    """
    获取现金流量表数据
    
    Args:
        symbol: 股票代码
        freq: 频率（季度/年度）
        curr_date: 当前日期（未使用，保持接口一致性）
        
    Returns:
        str: CSV格式的现金流量表数据
    """
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "cashflow retrieval")
        
        if market != 'A_STOCK':
            return f"Financial data is mainly available for A-shares only"
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
        
        log_operation("get_cashflow", symbol, market, "ATTEMPT")
        
        # 获取现金流量表数据
        data = ak.stock_cash_flow_sheet_by_report_em(symbol=clean_symbol)
        
        if data.empty:
            log_operation("get_cashflow", symbol, market, "FAILED")
            return f"No cashflow data found for symbol '{symbol}'"
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Cash Flow Statement for {symbol} ({market_info['market_name']})",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Frequency: {freq}",
            f"# Data source: AKShare",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_cashflow", symbol, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_cashflow", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_akshare_exception(e, "retrieving cashflow", symbol)


def get_fundamentals(
    symbol: Annotated[str, "ticker symbol of the company"]
) -> str:
    """
    获取基本面数据（主要是公司基本信息）
    
    Args:
        symbol: 股票代码
        
    Returns:
        str: CSV格式的基本面数据
    """
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "fundamentals retrieval")
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        
        log_operation("get_fundamentals", symbol, market, "ATTEMPT")
        
        if market == 'A_STOCK':
            # A股基本面信息
            clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
            basic_info = ak.stock_individual_info_em(symbol=clean_symbol)
            
            # 转换为更易读的格式
            info_dict = {}
            for _, row in basic_info.iterrows():
                info_dict[row['item']] = row['value']
            
            # 转换为DataFrame以便输出CSV
            import pandas as pd
            info_df = pd.DataFrame(list(info_dict.items()), columns=['Item', 'Value'])
            csv_string = info_df.to_csv(index=False)
            
        elif market == 'HK_STOCK':
            log_operation("get_fundamentals", symbol, market, "FAILED")
            return f"Fundamentals for Hong Kong stocks not fully supported by AKShare"
            
        elif market == 'US_STOCK':
            log_operation("get_fundamentals", symbol, market, "FAILED")
            return f"Fundamentals for US stocks not fully supported by AKShare"
        
        # 构建头部信息
        header_lines = [
            f"# Fundamentals for {symbol} ({market_info['market_name']})",
            f"# Formatted symbol: {formatted_symbol}",
            f"# Market: {market_info['market_name']} ({market_info['currency']})",
            f"# Data source: AKShare",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_fundamentals", symbol, market, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_fundamentals", symbol, market if 'market' in locals() else None, "FAILED")
        return handle_akshare_exception(e, "retrieving fundamentals", symbol)