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

# Optional pandas import for type checker/runtime
try:
    import pandas as pd
except Exception:
    pd = None  # type: ignore


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
    market = "UNKNOWN"
    symbol = str(symbol or "")
    freq = str(freq or "")
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "balance sheet retrieval")
        market = market or "UNKNOWN"
        

        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
        em_symbol = formatted_symbol.upper()
        
        log_operation("get_balance_sheet", symbol, market, "ATTEMPT")
        
        # 获取资产负债表数据
        if market == 'A_STOCK':
            freq_norm = (freq or '').lower()
            func_name = "stock_balance_sheet_by_yearly_em" if freq_norm in ["annual", "year", "年度"] else "stock_balance_sheet_by_report_em"
            data = getattr(ak, func_name)(symbol=em_symbol)
        elif market == 'HK_STOCK':
            # 港股：使用东财港股财务报表接口
            # freq 映射到 indicator：quarterly -> 报告期, annual -> 年度
            indicator = '年度' if (freq or '').lower() not in ['quarterly', 'q', '季报'] else '报告期'
            # 报表名：资产负债表
            hk_code = ''.join([c for c in formatted_symbol if c.isdigit()]) or symbol  # 尽力提取纯数字代码
            data = getattr(ak, "stock_financial_hk_report_em")(stock=hk_code, symbol="资产负债表", indicator=indicator)
        elif market == 'US_STOCK':
            # 美股：使用东财美股财务报表接口
            # freq 映射到 indicator：quarterly -> 单季报, annual -> 年报
            indicator = '年报' if (freq or '').lower() not in ['quarterly', 'q', '季报'] else '单季报'
            us_code = formatted_symbol.replace('.', '_')  # 例如 BRK.A -> BRK_A
            data = getattr(ak, "stock_financial_us_report_em")(stock=us_code, symbol="资产负债表", indicator=indicator)
        else:
            data = None
        
        if data is None or data.empty:
            log_operation("get_balance_sheet", str(symbol or ""), str(market or "UNKNOWN"), "FAILED")
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
        log_operation("get_balance_sheet", str(symbol or ""), "UNKNOWN" if (not isinstance(market, str) or market is None) else str(market), "FAILED")
        return handle_akshare_exception(e, "retrieving balance sheet", str(symbol or ""))


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
    market = "UNKNOWN"
    symbol = str(symbol or "")
    freq = str(freq or "")
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "income statement retrieval")
        market = market or "UNKNOWN"
        

        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
        em_symbol = formatted_symbol.upper()
        
        log_operation("get_income_statement", symbol, market, "ATTEMPT")
        
        # 获取利润表/综合损益表数据
        if market == 'A_STOCK':
            freq_norm = (freq or '').lower()
            if freq_norm in ["annual", "year", "年度"]:
                func_name = "stock_profit_sheet_by_yearly_em"
            elif freq_norm in ["quarterly", "q", "季度", "单季报"]:
                func_name = "stock_profit_sheet_by_quarterly_em"
            else:
                func_name = "stock_profit_sheet_by_report_em"
            data = getattr(ak, func_name)(symbol=em_symbol)
        elif market == 'HK_STOCK':
            indicator = '年度' if (freq or '').lower() not in ['quarterly', 'q', '季报'] else '报告期'
            hk_code = ''.join([c for c in formatted_symbol if c.isdigit()]) or symbol
            data = getattr(ak, "stock_financial_hk_report_em")(stock=hk_code, symbol="利润表", indicator=indicator)
        elif market == 'US_STOCK':
            indicator = '年报' if (freq or '').lower() not in ['quarterly', 'q', '季报'] else '单季报'
            us_code = formatted_symbol.replace('.', '_')
            # 美股利润表为“综合损益表”
            data = getattr(ak, "stock_financial_us_report_em")(stock=us_code, symbol="综合损益表", indicator=indicator)
        else:
            data = None
        
        if data is None or data.empty:
            log_operation("get_income_statement", str(symbol or ""), str(market or "UNKNOWN"), "FAILED")
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
        log_operation("get_income_statement", str(symbol or ""), "UNKNOWN" if (not isinstance(market, str) or market is None) else str(market), "FAILED")
        return handle_akshare_exception(e, "retrieving income statement", str(symbol or ""))


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
    market = "UNKNOWN"
    symbol = str(symbol or "")
    freq = str(freq or "")
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "cashflow retrieval")
        market = market or "UNKNOWN"
        

        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
        em_symbol = formatted_symbol.upper()
        
        log_operation("get_cashflow", symbol, market, "ATTEMPT")
        
        # 获取现金流量表数据
        if market == 'A_STOCK':
            freq_norm = (freq or '').lower()
            if freq_norm in ["annual", "year", "年度"]:
                func_name = "stock_cash_flow_sheet_by_yearly_em"
            elif freq_norm in ["quarterly", "q", "季度", "单季报"]:
                func_name = "stock_cash_flow_sheet_by_quarterly_em"
            else:
                func_name = "stock_cash_flow_sheet_by_report_em"
            data = getattr(ak, func_name)(symbol=em_symbol)
        elif market == 'HK_STOCK':
            indicator = '年度' if (freq or '').lower() not in ['quarterly', 'q', '季报'] else '报告期'
            hk_code = ''.join([c for c in formatted_symbol if c.isdigit()]) or symbol
            data = getattr(ak, "stock_financial_hk_report_em")(stock=hk_code, symbol="现金流量表", indicator=indicator)
        elif market == 'US_STOCK':
            indicator = '年报' if (freq or '').lower() not in ['quarterly', 'q', '季报'] else '单季报'
            us_code = formatted_symbol.replace('.', '_')
            data = getattr(ak, "stock_financial_us_report_em")(stock=us_code, symbol="现金流量表", indicator=indicator)
        else:
            data = None
        
        if data is None or data.empty:
            log_operation("get_cashflow", str(symbol or ""), str(market or "UNKNOWN"), "FAILED")
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
        log_operation("get_cashflow", str(symbol or ""), "UNKNOWN" if (not isinstance(market, str) or market is None) else str(market), "FAILED")
        return handle_akshare_exception(e, "retrieving cashflow", str(symbol or ""))


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
    market = "UNKNOWN"
    symbol = str(symbol or "")
    try:
        check_akshare_availability()
        
        # 验证市场支持并获取市场信息
        market, market_info = validate_market_support(symbol, "fundamentals retrieval")
        market = market or "UNKNOWN"
        
        # 格式化股票代码
        formatted_symbol = format_symbol_for_market(symbol, market)
        
        log_operation("get_fundamentals", symbol, market, "ATTEMPT")
        csv_string = ""
        
        if market == 'A_STOCK':
            # A股基本面信息
            clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
            em_symbol = formatted_symbol.upper()
            basic_info = getattr(ak, "stock_individual_basic_info_xq")(symbol=em_symbol)
            
            # 转换为更易读的格式
            info_dict = {}
            for _, row in basic_info.iterrows():
                info_dict[row['item']] = row['value']
            
            # 转换为DataFrame以便输出CSV（无 pandas 时降级为手工 CSV）
            # pandas imported at module level
            if pd is not None:
                info_df = pd.DataFrame(list(info_dict.items()), columns=['Item', 'Value'])
                csv_string = info_df.to_csv(index=False)
            else:
                csv_rows = ["Item,Value"] + [f"{k},{v}" for k, v in info_dict.items()]
                csv_string = "\n".join(csv_rows)
            
        elif market == 'HK_STOCK':
            # 香港个股基本信息（雪球）
            hk_code = ''.join([c for c in formatted_symbol if c.isdigit()]) or symbol
            hk_code = hk_code.zfill(5)
            basic_info = getattr(ak, "stock_individual_basic_info_hk_xq")(symbol=hk_code)
            # 转换为更易读的格式
            info_dict = {}
            for _, row in basic_info.iterrows():
                info_dict[row['item']] = row['value']
            # 转换为DataFrame以便输出CSV（无 pandas 时降级为手工 CSV）
            if pd is not None:
                info_df = pd.DataFrame(list(info_dict.items()), columns=['Item', 'Value'])
                csv_string = info_df.to_csv(index=False)
            else:
                csv_rows = ["Item,Value"] + [f"{k},{v}" for k, v in info_dict.items()]
                csv_string = "\n".join(csv_rows)
        elif market == 'US_STOCK':
            # 美股个股基本信息（雪球）
            us_code = formatted_symbol.replace('.', '_')
            basic_info = getattr(ak, "stock_individual_basic_info_us_xq")(symbol=us_code)
            # 转换为更易读的格式
            info_dict = {}
            for _, row in basic_info.iterrows():
                info_dict[row['item']] = row['value']
            # 转换为DataFrame以便输出CSV（无 pandas 时降级为手工 CSV）
            if pd is not None:
                info_df = pd.DataFrame(list(info_dict.items()), columns=['Item', 'Value'])
                csv_string = info_df.to_csv(index=False)
            else:
                csv_rows = ["Item,Value"] + [f"{k},{v}" for k, v in info_dict.items()]
                csv_string = "\n".join(csv_rows)
        
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
        log_operation("get_fundamentals", str(symbol or ""), "UNKNOWN" if (not isinstance(market, str) or market is None) else str(market), "FAILED")
        return handle_akshare_exception(e, "retrieving fundamentals", str(symbol or ""))