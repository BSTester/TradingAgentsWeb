"""
BaoStock公共工具模块
提供BaoStock数据获取的公共函数、异常处理和工具函数
"""
from typing import Tuple, Dict, Any
from datetime import datetime
import pandas as pd

try:
    import baostock as bs
    BAOSTOCK_AVAILABLE = True
except ImportError:
    BAOSTOCK_AVAILABLE = False
    print("Warning: BaoStock not installed. Install with: pip install baostock")

from .market_utils import MarketIdentifier, get_market_info


class BaoStockDataError(Exception):
    """BaoStock数据获取异常"""
    pass


class BaoStockSession:
    """BaoStock session manager to handle login/logout."""
    
    def __init__(self):
        self.logged_in = False
    
    def __enter__(self):
        if BAOSTOCK_AVAILABLE:
            lg = bs.login()
            if lg.error_code != '0':
                raise BaoStockDataError(f"BaoStock login failed: {lg.error_msg}")
            self.logged_in = True
            print("[BaoStock] Successfully logged in")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if BAOSTOCK_AVAILABLE and self.logged_in:
            bs.logout()
            print("[BaoStock] Successfully logged out")


def check_baostock_availability():
    """检查BaoStock是否可用"""
    if not BAOSTOCK_AVAILABLE:
        raise BaoStockDataError("BaoStock is not installed. Please install with: pip install baostock")


def validate_market_support(symbol: str, operation: str = "operation") -> Tuple[str, Dict[str, Any]]:
    """
    验证市场支持并返回市场信息
    
    Args:
        symbol: 股票代码
        operation: 操作名称，用于错误信息
        
    Returns:
        Tuple[str, Dict[str, Any]]: (市场类型, 市场信息)
    """
    market_info = get_market_info(symbol)
    market = market_info['market']
    
    if not MarketIdentifier.is_market_supported(symbol, 'baostock'):
        raise BaoStockDataError(f"Market {market} is not supported by BaoStock for {operation} (A-shares only)")
    
    return market, market_info


def format_symbol_for_baostock(symbol: str, market: str) -> str:
    """
    格式化股票代码为BaoStock要求的格式
    
    Args:
        symbol: 原始股票代码
        market: 市场类型
        
    Returns:
        str: 格式化后的股票代码
    """
    return MarketIdentifier.format_symbol_for_vendor(symbol, 'baostock', market)


def validate_date_format(date_str: str) -> None:
    """
    验证日期格式
    
    Args:
        date_str: 日期字符串
        
    Raises:
        BaoStockDataError: 日期格式错误
    """
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise BaoStockDataError(f"Invalid date format: {date_str}. Expected format: YYYY-MM-DD")


def standardize_column_names(data: pd.DataFrame, data_type: str = "stock") -> pd.DataFrame:
    """
    标准化列名
    
    Args:
        data: 原始数据DataFrame
        data_type: 数据类型
        
    Returns:
        pd.DataFrame: 标准化列名后的数据
    """
    if data_type == "stock":
        # 股票数据列名映射
        column_mapping = {
            'open': 'Open',
            'high': 'High', 
            'low': 'Low',
            'close': 'Close',
            'preclose': 'Prev_Close',
            'volume': 'Volume',
            'amount': 'Amount',
            'turn': 'Turnover',
            'pctChg': 'Change_Pct',
            'tradestatus': 'Trade_Status',
            'isST': 'Is_ST'
        }
        data = data.rename(columns=column_mapping)
        
        # 数值列转换
        numeric_columns = ['Open', 'High', 'Low', 'Close', 'Prev_Close', 'Volume', 'Amount', 'Turnover', 'Change_Pct']
        for col in numeric_columns:
            if col in data.columns:
                data[col] = pd.to_numeric(data[col], errors='coerce').round(2)
    
    return data


def process_dataframe_for_output(
    data: pd.DataFrame, 
    symbol: str, 
    market_info: Dict[str, Any], 
    data_type: str,
    additional_info: Dict[str, str] = None
) -> str:
    """
    处理DataFrame并生成标准化输出
    
    Args:
        data: 数据DataFrame
        symbol: 股票代码
        market_info: 市场信息
        data_type: 数据类型
        additional_info: 额外信息
        
    Returns:
        str: 标准化的CSV输出
    """
    # 转换为CSV字符串
    csv_string = data.to_csv()
    
    # 构建头部信息
    header_lines = [
        f"# {data_type} data for {symbol} ({market_info['market_name']})",
        f"# Market: {market_info['market_name']} ({market_info['currency']})",
        f"# Total records: {len(data)}",
        f"# Data source: BaoStock",
        f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    ]
    
    # 添加额外信息
    if additional_info:
        for key, value in additional_info.items():
            header_lines.insert(-2, f"# {key}: {value}")
    
    header = '\n'.join(header_lines) + '\n\n'
    
    return header + csv_string


def handle_baostock_exception(e: Exception, operation: str, symbol: str = None) -> str:
    """
    处理BaoStock异常并返回标准化错误信息
    
    Args:
        e: 异常对象
        operation: 操作名称
        symbol: 股票代码（可选）
        
    Returns:
        str: 标准化错误信息
        
    Raises:
        Exception: 对于网络相关错误或模块未安装错误，重新抛出异常以触发降级处理
    """
    error_str = str(e).lower()
    symbol_info = f" for {symbol}" if symbol else ""
    
    # 检查是否为需要触发降级的错误类型
    trigger_fallback_keywords = [
        'baostock is not installed',
        'no module named',
        'connection',
        'network', 
        'timeout',
        'remote',
        'aborted',
        'disconnected'
    ]
    
    if any(keyword in error_str for keyword in trigger_fallback_keywords):
        raise Exception(f"BaoStock error {operation}{symbol_info}: {str(e)}")
    
    # 对于其他错误，返回错误字符串
    return f"Error {operation}{symbol_info}: {str(e)}"


def log_operation(operation: str, symbol: str = None, market: str = None, status: str = "INFO") -> None:
    """
    记录操作日志
    
    Args:
        operation: 操作名称
        symbol: 股票代码（可选）
        market: 市场类型（可选）
        status: 状态
    """
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    if symbol and market:
        print(f"[BaoStock] {status}: {operation} {symbol} ({market})")
    elif symbol:
        print(f"[BaoStock] {status}: {operation} {symbol}")
    else:
        print(f"[BaoStock] {status}: {operation}")


# 导出BaoStock对象以供其他模块使用
bs = bs if BAOSTOCK_AVAILABLE else None