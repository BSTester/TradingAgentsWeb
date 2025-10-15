"""
AKShare技术指标实现模块
基于AKShare提供的股票数据计算各种技术指标
"""
from typing import Annotated
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from .market_utils import MarketIdentifier, get_market_info

try:
    import akshare as ak
    AKSHARE_AVAILABLE = True
except ImportError:
    AKSHARE_AVAILABLE = False
    print("Warning: AKShare not installed. Install with: pip install akshare")

try:
    import talib
    TALIB_AVAILABLE = True
except ImportError:
    TALIB_AVAILABLE = False
    print("Info: TA-Lib not available, using pandas-based calculations")


def get_akshare_indicators(
    symbol: Annotated[str, "ticker symbol of the company"],
    indicator: Annotated[str, "technical indicator to get the analysis and report of"],
    curr_date: Annotated[str, "The current trading date you are trading on, YYYY-mm-dd"],
    look_back_days: Annotated[int, "how many days to look back"] = 30,
) -> str:
    """
    使用AKShare数据计算技术指标
    
    Args:
        symbol: 股票代码
        indicator: 技术指标名称
        curr_date: 当前交易日期
        look_back_days: 回看天数
        
    Returns:
        str: 包含指标值和描述的字符串
    """
    if not AKSHARE_AVAILABLE:
        return "Error: AKShare is not installed. Please install with: pip install akshare"
    
    # 支持的技术指标参数说明
    indicator_params = {
        # 移动平均线
        "close_50_sma": {
            "name": "50 SMA",
            "description": "50日简单移动平均线：中期趋势指标。用法：识别趋势方向并作为动态支撑/阻力。技巧：滞后于价格，需结合更快指标获得及时信号。",
            "calc_func": lambda df: calculate_sma(df, 50)
        },
        "close_200_sma": {
            "name": "200 SMA", 
            "description": "200日简单移动平均线：长期趋势基准。用法：确认整体市场趋势和黄金/死亡交叉设置。技巧：反应缓慢，最适合战略趋势确认而非频繁交易入场。",
            "calc_func": lambda df: calculate_sma(df, 200)
        },
        "close_10_ema": {
            "name": "10 EMA",
            "description": "10日指数移动平均线：敏感的短期平均线。用法：捕捉动量快速变化和潜在入场点。技巧：在震荡市场容易产生噪音，需与更长周期平均线结合使用。",
            "calc_func": lambda df: calculate_ema(df, 10)
        },
        
        # MACD相关
        "macd": {
            "name": "MACD",
            "description": "MACD：通过EMA差值计算动量。用法：寻找交叉和背离作为趋势变化信号。技巧：在低波动或横盘市场中与其他指标确认。",
            "calc_func": lambda df: calculate_macd(df)['macd']
        },
        "macds": {
            "name": "MACD Signal",
            "description": "MACD信号线：MACD线的EMA平滑。用法：与MACD线交叉触发交易。技巧：应作为更广泛策略的一部分，避免假阳性。",
            "calc_func": lambda df: calculate_macd(df)['signal']
        },
        "macdh": {
            "name": "MACD Histogram",
            "description": "MACD柱状图：显示MACD线与信号线之间的差距。用法：可视化动量强度并早期发现背离。技巧：可能波动，需在快速市场中结合额外过滤器。",
            "calc_func": lambda df: calculate_macd(df)['histogram']
        },
        
        # 动量指标
        "rsi": {
            "name": "RSI",
            "description": "RSI：测量动量以标记超买/超卖状况。用法：应用70/30阈值并观察背离信号反转。技巧：在强趋势中RSI可能保持极值，始终与趋势分析交叉检查。",
            "calc_func": lambda df: calculate_rsi(df, 14)
        },
        
        # 波动性指标
        "boll": {
            "name": "Bollinger Middle",
            "description": "布林带中轨：20日SMA作为布林带基础。用法：作为价格运动的动态基准。技巧：与上下轨结合使用，有效发现突破或反转。",
            "calc_func": lambda df: calculate_bollinger_bands(df)['middle']
        },
        "boll_ub": {
            "name": "Bollinger Upper Band",
            "description": "布林带上轨：通常是中线上方2个标准差。用法：信号潜在超买状况和突破区域。技巧：用其他工具确认信号，价格可能在强趋势中沿着带运行。",
            "calc_func": lambda df: calculate_bollinger_bands(df)['upper']
        },
        "boll_lb": {
            "name": "Bollinger Lower Band", 
            "description": "布林带下轨：通常是中线下方2个标准差。用法：表示潜在超卖状况。技巧：使用额外分析避免假反转信号。",
            "calc_func": lambda df: calculate_bollinger_bands(df)['lower']
        },
        "atr": {
            "name": "ATR",
            "description": "ATR：平均真实范围测量波动性。用法：设置止损水平并根据当前市场波动性调整仓位大小。技巧：这是一个反应性指标，作为更广泛风险管理策略的一部分。",
            "calc_func": lambda df: calculate_atr(df, 14)
        },
        
        # 成交量指标
        "vwma": {
            "name": "VWMA",
            "description": "VWMA：按成交量加权的移动平均线。用法：通过整合价格行动与成交量数据确认趋势。技巧：注意成交量突增造成的偏斜结果，与其他成交量分析结合使用。",
            "calc_func": lambda df: calculate_vwma(df, 20)
        },
        "mfi": {
            "name": "MFI", 
            "description": "MFI：资金流量指数是使用价格和成交量测量买卖压力的动量指标。用法：识别超买(>80)或超卖(<20)状况并确认趋势或反转的强度。技巧：与RSI或MACD一起使用确认信号，价格与MFI之间的背离可能表示潜在反转。",
            "calc_func": lambda df: calculate_mfi(df, 14)
        }
    }
    
    if indicator not in indicator_params:
        supported_indicators = list(indicator_params.keys())
        return f"Error: Indicator '{indicator}' is not supported. Supported indicators: {supported_indicators}"
    
    try:
        # 获取股票数据
        market_info = get_market_info(symbol)
        market = market_info['market']
        
        if not MarketIdentifier.is_market_supported(symbol, 'akshare'):
            return f"Error: Market {market} is not supported by AKShare"
        
        # 计算需要的数据范围（多获取一些数据用于计算）
        curr_date_dt = datetime.strptime(curr_date, "%Y-%m-%d")
        start_date = curr_date_dt - relativedelta(days=look_back_days + 200)  # 额外获取200天用于计算
        start_date_str = start_date.strftime("%Y-%m-%d")
        end_date_str = curr_date
        
        # 使用akshare股票数据获取函数
        from .akshare_stock import get_stock_data
        stock_data_csv = get_stock_data(symbol, start_date_str, end_date_str)
        
        if stock_data_csv.startswith("Error") or stock_data_csv.startswith("No data"):
            return f"Error getting stock data: {stock_data_csv}"
        
        # 解析CSV数据
        lines = stock_data_csv.split('\n')
        data_start = 0
        for i, line in enumerate(lines):
            line = line.strip()
            if line and ('Date,' in line or line.startswith('Date,') or 
                        'date,' in line or line.startswith('date,')):
                data_start = i
                break
        
        csv_data = '\n'.join(lines[data_start:]).strip()
        if not csv_data:
            return f"Error: No valid CSV data found for {symbol}"
            
        import io
        # 首先读取数据不指定索引列
        df_raw = pd.read_csv(io.StringIO(csv_data))
        
        # 检查是否有日期列并设置为索引
        date_col = None
        for col in ['Date', 'date']:
            if col in df_raw.columns:
                date_col = col
                break
        
        if date_col is None:
            return f"Error: No date column found in data for {symbol}"
        
        # 设置日期列为索引
        df_raw[date_col] = pd.to_datetime(df_raw[date_col])
        df = df_raw.set_index(date_col)
        
        # 标准化列名（确保High, Low, Close等是正确的大小写）
        column_mapping = {
            'open': 'Open',
            'high': 'High',
            'low': 'Low',
            'close': 'Close',
            'volume': 'Volume'
        }
        df = df.rename(columns=column_mapping)
        
        if df.empty:
            return f"Error: No valid data for symbol {symbol}"
        
        # 计算指标
        indicator_info = indicator_params[indicator]
        calc_func = indicator_info['calc_func']
        indicator_values = calc_func(df)
        
        # 生成指定日期范围内的结果
        end_date_dt = curr_date_dt
        before_date = curr_date_dt - relativedelta(days=look_back_days)
        
        result_string = ""
        current_dt = end_date_dt
        
        while current_dt >= before_date:
            date_str = current_dt.strftime('%Y-%m-%d')
            
            # 查找最接近的交易日数据
            if isinstance(indicator_values, pd.Series):
                # 找到最接近的日期
                available_dates = indicator_values.index
                closest_date = None
                min_diff = float('inf')
                
                for avail_date in available_dates:
                    if isinstance(avail_date, str):
                        avail_dt = datetime.strptime(avail_date, '%Y-%m-%d')
                    else:
                        avail_dt = avail_date
                    
                    diff = abs((current_dt - avail_dt).days)
                    if diff < min_diff and avail_dt <= current_dt:
                        min_diff = diff
                        closest_date = avail_date
                
                if closest_date is not None and min_diff <= 7:  # 7天内的数据有效
                    value = indicator_values.loc[closest_date]
                    if pd.isna(value):
                        result_string += f"{date_str}: N/A\n"
                    else:
                        result_string += f"{date_str}: {value:.4f}\n"
                else:
                    result_string += f"{date_str}: N/A: Not a trading day\n"
            else:
                result_string += f"{date_str}: N/A: Calculation error\n"
            
            current_dt = current_dt - relativedelta(days=1)
        
        # 构建最终结果
        final_result = f"## {indicator_info['name']} values from {before_date.strftime('%Y-%m-%d')} to {end_date_str}:\n\n"
        final_result += result_string
        final_result += f"\n\n{indicator_info['description']}"
        
        return final_result
        
    except Exception as e:
        return f"Error calculating {indicator} for {symbol}: {str(e)}"


# 技术指标计算函数

def calculate_sma(df: pd.DataFrame, period: int) -> pd.Series:
    """计算简单移动平均线"""
    return df['Close'].rolling(window=period).mean()


def calculate_ema(df: pd.DataFrame, period: int) -> pd.Series:
    """计算指数移动平均线"""
    return df['Close'].ewm(span=period, adjust=False).mean()


def calculate_macd(df: pd.DataFrame, fast=12, slow=26, signal=9) -> dict:
    """计算MACD指标"""
    ema_fast = df['Close'].ewm(span=fast, adjust=False).mean()
    ema_slow = df['Close'].ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    
    return {
        'macd': macd_line,
        'signal': signal_line,
        'histogram': histogram
    }


def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """计算RSI指标"""
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calculate_bollinger_bands(df: pd.DataFrame, period: int = 20, std_dev: float = 2) -> dict:
    """计算布林带"""
    middle = df['Close'].rolling(window=period).mean()
    std = df['Close'].rolling(window=period).std()
    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)
    
    return {
        'upper': upper,
        'middle': middle,
        'lower': lower
    }


def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """计算真实范围平均值(ATR)"""
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    atr = true_range.rolling(window=period).mean()
    return atr


def calculate_vwma(df: pd.DataFrame, period: int = 20) -> pd.Series:
    """计算成交量加权移动平均线"""
    return (df['Close'] * df['Volume']).rolling(window=period).sum() / df['Volume'].rolling(window=period).sum()


def calculate_mfi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """计算资金流量指数(MFI)"""
    typical_price = (df['High'] + df['Low'] + df['Close']) / 3
    money_flow = typical_price * df['Volume']
    
    positive_flow = money_flow.where(typical_price > typical_price.shift(1), 0).rolling(window=period).sum()
    negative_flow = money_flow.where(typical_price < typical_price.shift(1), 0).rolling(window=period).sum()
    
    money_flow_ratio = positive_flow / negative_flow
    mfi = 100 - (100 / (1 + money_flow_ratio))
    return mfi