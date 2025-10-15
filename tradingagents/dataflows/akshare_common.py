"""
AKShare common utilities and shared functions
提供AKShare数据源的公共工具函数和配置
"""
import pandas as pd
from datetime import datetime
from typing import Optional, Tuple, Dict, Any
from .market_utils import MarketIdentifier, get_market_info

try:
    import akshare as ak
    AKSHARE_AVAILABLE = True
except ImportError:
    AKSHARE_AVAILABLE = False
    print("Warning: AKShare not installed. Install with: pip install akshare")


class AKShareError(Exception):
    """AKShare相关异常基类"""
    pass


class AKShareNotAvailableError(AKShareError):
    """AKShare未安装异常"""
    pass


class AKShareDataError(AKShareError):
    """AKShare数据获取异常"""
    pass


def check_akshare_availability():
    """检查AKShare是否可用"""
    if not AKSHARE_AVAILABLE:
        raise AKShareNotAvailableError("AKShare is not installed. Please install with: pip install akshare")


def format_symbol_for_market(symbol: str, market: str) -> str:
    """为特定市场格式化股票代码"""
    return MarketIdentifier.format_symbol_for_vendor(symbol, 'akshare', market)


def validate_date_format(date_str: str) -> None:
    """验证日期格式"""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"Invalid date format: {date_str}. Expected YYYY-MM-DD format.")


def format_date_for_akshare(date_str: str, market: str) -> str:
    """
    为AKShare接口格式化日期
    
    Args:
        date_str: YYYY-MM-DD格式的日期字符串
        market: 市场类型 (A_STOCK, HK_STOCK, US_STOCK)
        
    Returns:
        str: 格式化后的日期字符串
    """
    # AKShare的所有市场都使用YYYYMMDD格式
    return date_str.replace('-', '')


def standardize_column_names(df: pd.DataFrame, market: str) -> pd.DataFrame:
    """
    标准化DataFrame列名
    
    Args:
        df: 原始DataFrame
        market: 市场类型
        
    Returns:
        pd.DataFrame: 标准化后的DataFrame
    """
    if df.empty:
        return df
    
    # 基础列名映射
    column_mapping = {
        # A股列名映射（中文到英文）
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
        '换手率': 'Turnover',
        
        # 美股列名映射（小写到标准大写）
        'date': 'Date',
        'open': 'Open',
        'high': 'High',
        'low': 'Low',
        'close': 'Close',
        'volume': 'Volume',
    }
    
    # 重命名列
    df_renamed = df.rename(columns=column_mapping)
    
    return df_renamed


def process_dataframe_for_output(df: pd.DataFrame, symbol: str, market_info: Dict[str, Any], 
                                data_type: str, additional_info: Optional[Dict[str, Any]] = None) -> str:
    """
    处理DataFrame并生成标准化输出
    
    Args:
        df: 处理的DataFrame
        symbol: 股票代码
        market_info: 市场信息
        data_type: 数据类型描述
        additional_info: 额外信息
        
    Returns:
        str: 标准化的CSV输出字符串
    """
    if df.empty:
        return f"No {data_type} data found for symbol '{symbol}'"
    
    # 确保Date列是datetime类型并设置为索引（如果存在）
    if 'Date' in df.columns:
        df['Date'] = pd.to_datetime(df['Date'])
        df.set_index('Date', inplace=True)
    
    # 数值列保留2位小数
    numeric_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').round(2)
    
    # 转换为CSV字符串
    csv_string = df.to_csv()
    
    # 构建头部信息
    header_lines = [
        f"# {data_type} data for {symbol} ({market_info['market_name']})",
        f"# Market: {market_info['market_name']} ({market_info['currency']})",
        f"# Total records: {len(df)}",
        f"# Data source: AKShare",
        f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    ]
    
    # 添加额外信息
    if additional_info:
        for key, value in additional_info.items():
            header_lines.insert(-2, f"# {key}: {value}")
    
    header = '\n'.join(header_lines) + '\n\n'
    
    return header + csv_string


def handle_akshare_exception(e: Exception, operation: str, symbol: str = None) -> str:
    """
    统一处理AKShare异常
    
    Args:
        e: 异常对象
        operation: 操作描述
        symbol: 股票代码（可选）
        
    Returns:
        str: 标准化错误信息
        
    Raises:
        Exception: 对于网络相关错误，重新抛出异常以触发降级处理
    """
    symbol_info = f" for {symbol}" if symbol else ""
    error_str = str(e).lower()
    
    # 检查是否为网络相关错误，如果是则重新抛出以触发降级处理
    if any(keyword in error_str for keyword in ['connection', 'network', 'timeout', 'remote', 'aborted', 'disconnected']):
        raise Exception(f"Network error {operation}{symbol_info}: {str(e)}")
    
    # 对于其他错误，返回错误字符串
    return f"Error {operation}{symbol_info}: {str(e)}"


def validate_market_support(symbol: str, operation: str = "operation") -> Tuple[str, Dict[str, Any]]:
    """
    验证市场支持并返回市场信息
    
    Args:
        symbol: 股票代码
        operation: 操作描述
        
    Returns:
        Tuple[str, Dict]: (market, market_info)
        
    Raises:
        AKShareDataError: 当市场不支持时
    """
    market_info = get_market_info(symbol)
    market = market_info['market']
    
    if not MarketIdentifier.is_market_supported(symbol, 'akshare'):
        raise AKShareDataError(f"Market {market} is not supported by AKShare for {operation}")
    
    return market, market_info


def create_fallback_response(primary_error: str, fallback_result: Optional[str] = None) -> str:
    """
    创建带有fallback信息的响应
    
    Args:
        primary_error: 主要错误信息
        fallback_result: fallback结果（可选）
        
    Returns:
        str: 最终响应字符串
    """
    if fallback_result and not fallback_result.startswith("Error"):
        return fallback_result
    else:
        return primary_error


def log_operation(operation: str, symbol: str = None, market: str = None, status: str = "ATTEMPT"):
    """
    记录操作日志
    
    Args:
        operation: 操作名称
        symbol: 股票代码（可选）
        market: 市场类型（可选）
        status: 状态 (ATTEMPT, SUCCESS, FAILED)
    """
    symbol_info = f" {symbol}" if symbol else ""
    market_info = f" ({market})" if market else ""
    print(f"[AKShare] {status}: {operation}{symbol_info}{market_info}")