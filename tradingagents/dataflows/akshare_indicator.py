"""
AkShare Technical Indicators
Calculate technical indicators using AKShare (compatible with Alpha Vantage interface)
Returns CSV format with time series data
"""

import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Annotated
import time
from io import StringIO

from .akshare_common import _identify_market, MARKET_PATTERNS, get_akshare

logger = logging.getLogger(__name__)


def get_indicator(
    symbol: Annotated[str, "Stock symbol"],
    indicator: Annotated[str, "Technical indicator name"],
    curr_date: Annotated[str, "Current date in YYYY-MM-DD format"],
    look_back_days: Annotated[int, "Number of days to look back"],
    interval: Annotated[str, "Time interval"] = "daily",
    time_period: Annotated[int, "Number of data points for calculation"] = 14,
    series_type: Annotated[str, "Price type"] = "close"
) -> str:
    """
    Calculate technical indicators using AKShare (compatible with Alpha Vantage interface)
    
    Supported indicators (matching Alpha Vantage):
    - close_50_sma: 50-period Simple Moving Average
    - close_200_sma: 200-period Simple Moving Average
    - close_10_ema: 10-period Exponential Moving Average
    - macd: MACD line
    - macds: MACD Signal line
    - macdh: MACD Histogram
    - rsi: Relative Strength Index
    - boll: Bollinger Middle Band
    - boll_ub: Bollinger Upper Band
    - boll_lb: Bollinger Lower Band
    - atr: Average True Range
    - vwma: Volume Weighted Moving Average
    
    Args:
        symbol: Stock symbol
        indicator: Technical indicator name (see supported list above)
        curr_date: Current date in YYYY-MM-DD format
        look_back_days: Number of days to look back
        interval: Time interval (daily, weekly, monthly)
        time_period: Number of periods for calculation (e.g., 14 for RSI-14, 50 for SMA-50)
        series_type: Price type to use (close, open, high, low)
    
    Returns:
        CSV formatted string with time series indicator values (matching Alpha Vantage format)
    """
    ak = get_akshare()
    if not ak:
        return "Error: akshare not installed"
    
    # Supported indicators mapping: indicator_key -> (indicator_name, series_type)
    supported_indicators = {
        "close_50_sma": ("50 SMA", "close"),
        "close_200_sma": ("200 SMA", "close"),
        "close_10_ema": ("10 EMA", "close"),
        "macd": ("MACD", "close"),
        "macds": ("MACD Signal", "close"),
        "macdh": ("MACD Histogram", "close"),
        "rsi": ("RSI", "close"),
        "boll": ("Bollinger Middle", "close"),
        "boll_ub": ("Bollinger Upper Band", "close"),
        "boll_lb": ("Bollinger Lower Band", "close"),
        "atr": ("ATR", None),  # ATR uses High, Low, Close
        "vwma": ("VWMA", "close")
    }
    
    # Indicator descriptions (matching Alpha Vantage)
    indicator_descriptions = {
        "close_50_sma": "50 SMA: A medium-term trend indicator. Usage: Identify trend direction and serve as dynamic support/resistance. Tips: It lags price; combine with faster indicators for timely signals.",
        "close_200_sma": "200 SMA: A long-term trend benchmark. Usage: Confirm overall market trend and identify golden/death cross setups. Tips: It reacts slowly; best for strategic trend confirmation rather than frequent trading entries.",
        "close_10_ema": "10 EMA: A responsive short-term average. Usage: Capture quick shifts in momentum and potential entry points. Tips: Prone to noise in choppy markets; use alongside longer averages for filtering false signals.",
        "macd": "MACD: Computes momentum via differences of EMAs. Usage: Look for crossovers and divergence as signals of trend changes. Tips: Confirm with other indicators in low-volatility or sideways markets.",
        "macds": "MACD Signal: An EMA smoothing of the MACD line. Usage: Use crossovers with the MACD line to trigger trades. Tips: Should be part of a broader strategy to avoid false positives.",
        "macdh": "MACD Histogram: Shows the gap between the MACD line and its signal. Usage: Visualize momentum strength and spot divergence early. Tips: Can be volatile; complement with additional filters in fast-moving markets.",
        "rsi": "RSI: Measures momentum to flag overbought/oversold conditions. Usage: Apply 70/30 thresholds and watch for divergence to signal reversals. Tips: In strong trends, RSI may remain extreme; always cross-check with trend analysis.",
        "boll": "Bollinger Middle: A 20 SMA serving as the basis for Bollinger Bands. Usage: Acts as a dynamic benchmark for price movement. Tips: Combine with the upper and lower bands to effectively spot breakouts or reversals.",
        "boll_ub": "Bollinger Upper Band: Typically 2 standard deviations above the middle line. Usage: Signals potential overbought conditions and breakout zones. Tips: Confirm signals with other tools; prices may ride the band in strong trends.",
        "boll_lb": "Bollinger Lower Band: Typically 2 standard deviations below the middle line. Usage: Indicates potential oversold conditions. Tips: Use additional analysis to avoid false reversal signals.",
        "atr": "ATR: Averages true range to measure volatility. Usage: Set stop-loss levels and adjust position sizes based on current market volatility. Tips: It's a reactive measure, so use it as part of a broader risk management strategy.",
        "vwma": "VWMA: A moving average weighted by volume. Usage: Confirm trends by integrating price action with volume data. Tips: Watch for skewed results from volume spikes; use in combination with other volume analyses."
    }
    
    # Normalize indicator name to lowercase for case-insensitive matching
    indicator_lower = indicator.lower()
    
    # Validate indicator
    if indicator_lower not in supported_indicators:
        raise ValueError(
            f"Indicator {indicator} is not supported. Please choose from: {list(supported_indicators.keys())}"
        )
    
    try:
        # Import stock data function
        from .akshare_stock import get_stock
        from dateutil.relativedelta import relativedelta
        
        # Calculate date range
        curr_date_dt = datetime.strptime(curr_date, "%Y-%m-%d")
        before = curr_date_dt - relativedelta(days=look_back_days)
        
        # Get indicator name and required series type
        indicator_name, required_series = supported_indicators[indicator_lower]
        
        # Determine period based on indicator
        if "50" in indicator_name:
            period = 50
        elif "200" in indicator_name:
            period = 200
        elif "10" in indicator_name:
            period = 10
        elif "RSI" in indicator_name:
            period = time_period
        elif "Bollinger" in indicator_name:
            period = 20
        elif "ATR" in indicator_name:
            period = time_period
        elif "VWMA" in indicator_name:
            period = time_period
        else:
            period = 26  # Default for MACD
        
        # Calculate extra days needed for indicator warmup based on interval
        if interval == "weekly":
            # For weekly, need more days (weeks * 7)
            extra_periods = max(period * 7 if period else 200, 200)
        elif interval == "monthly":
            # For monthly, need even more days (months * 30)
            extra_periods = max(period * 30 if period else 365, 365)
        else:  # daily
            extra_periods = max(period * 3 if period else 200, 200)
        
        start_date_dt = before - timedelta(days=extra_periods)
        start_date = start_date_dt.strftime("%Y-%m-%d")
        end_date = curr_date
        
        # Get daily price data (always fetch daily, then resample if needed)
        logger.info(f"Fetching price data for {symbol} from {start_date} to {end_date}")
        price_data_str = get_stock(symbol, start_date, end_date)
        
        if price_data_str.startswith("Error") or price_data_str.startswith("No data"):
            return f"Error: Unable to fetch price data for {symbol}"
        
        # Parse CSV data
        lines = price_data_str.split('\n')
        csv_start = 0
        for i, line in enumerate(lines):
            if line.startswith('Date') or line.startswith('日期'):
                csv_start = i
                break
        
        csv_data = '\n'.join(lines[csv_start:])
        df = pd.read_csv(StringIO(csv_data))
        
        if df.empty:
            return f"Error: No price data available for {symbol}"
        
        # Standardize column names
        column_mapping = {
            '日期': 'Date',
            '开盘': 'Open',
            '最高': 'High',
            '最低': 'Low',
            '收盘': 'Close',
            '成交量': 'Volume',
            'volume': 'Volume'
        }
        df = df.rename(columns=column_mapping)
        
        # Ensure Date column is datetime
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.sort_values('Date')
        df = df.set_index('Date')
        
        # Resample data based on interval
        if interval == "weekly":
            # Resample to weekly (week ending Friday)
            df_resampled = df.resample('W-FRI').agg({
                'Open': 'first',
                'High': 'max',
                'Low': 'min',
                'Close': 'last',
                'Volume': 'sum'
            }).dropna()
        elif interval == "monthly":
            # Resample to monthly (month end)
            df_resampled = df.resample('M').agg({
                'Open': 'first',
                'High': 'max',
                'Low': 'min',
                'Close': 'last',
                'Volume': 'sum'
            }).dropna()
        else:  # daily
            df_resampled = df
        
        if df_resampled.empty:
            return f"Error: No data available after resampling to {interval}"
        
        # Determine which price column to use
        # Use required_series from indicator definition, or fall back to series_type parameter
        effective_series = required_series if required_series else series_type
        
        series_type_map = {
            'close': 'Close',
            'open': 'Open',
            'high': 'High',
            'low': 'Low'
        }
        price_col = series_type_map.get(effective_series.lower() if effective_series else 'close', 'Close')
        
        if price_col not in df_resampled.columns and indicator_name != "ATR":
            return f"Error: Price column '{price_col}' not found in data"
        
        # Calculate indicator
        result_df = _calculate_indicator(
            df_resampled, 
            indicator_lower, 
            indicator_name, 
            period, 
            price_col, 
            time_period
        )
        
        if result_df is None or result_df.empty:
            return f"Error: Failed to calculate {indicator}"
        
        # Filter to requested date range
        filtered_df = result_df[
            (result_df['time'] >= before) &
            (result_df['time'] <= curr_date_dt)
        ].copy()
        
        if filtered_df.empty:
            # Fallback: use the last N rows
            n = max(1, min(look_back_days, len(result_df)))
            filtered_df = result_df.tail(n).copy()
        
        # Format as CSV (matching Alpha Vantage format)
        csv_output = filtered_df.to_csv(index=False)
        
        return csv_output
        
    except Exception as e:
        logger.error(f"Error calculating {indicator} for {symbol}: {str(e)}")
        return f"Error calculating {indicator} for {symbol}: {str(e)}"


def _calculate_indicator(df: pd.DataFrame, indicator_key: str, indicator_name: str, 
                         period: int, price_col: str, time_period: int) -> pd.DataFrame:
    """
    Calculate technical indicator and return DataFrame with time and value columns
    
    Args:
        df: DataFrame with OHLCV data (index is Date)
        indicator_key: Indicator key (e.g., 'close_50_sma')
        indicator_name: Indicator display name (e.g., '50 SMA')
        period: Period for calculation
        price_col: Price column to use
        time_period: Time period parameter
    
    Returns:
        DataFrame with 'time' and indicator value column(s)
    """
    try:
        import talib
        has_talib = True
    except ImportError:
        has_talib = False
        logger.warning("TA-Lib not available, using pandas fallback")
    
    result_df = pd.DataFrame()
    result_df['time'] = df.index
    
    # === SMA Indicators ===
    if "SMA" in indicator_name:
        if has_talib:
            values = talib.SMA(df[price_col].values, timeperiod=period)
        else:
            values = df[price_col].rolling(window=period, min_periods=1).mean()
        result_df[indicator_name] = values
    
    # === EMA Indicators ===
    elif "EMA" in indicator_name:
        if has_talib:
            values = talib.EMA(df[price_col].values, timeperiod=period)
        else:
            values = df[price_col].ewm(span=period, adjust=False).mean()
        result_df[indicator_name] = values
    
    # === MACD Indicators ===
    elif "MACD" in indicator_name:
        if has_talib:
            macd, signal, hist = talib.MACD(df[price_col].values)
        else:
            # Fallback: simple MACD calculation
            exp1 = df[price_col].ewm(span=12, adjust=False).mean()
            exp2 = df[price_col].ewm(span=26, adjust=False).mean()
            macd = exp1 - exp2
            signal = macd.ewm(span=9, adjust=False).mean()
            hist = macd - signal
        
        if indicator_name == "MACD":
            result_df['MACD'] = macd
        elif indicator_name == "MACD Signal":
            result_df['MACD Signal'] = signal
        else:  # MACD Histogram
            result_df['MACD Histogram'] = hist
    
    # === RSI Indicator ===
    elif indicator_name == "RSI":
        if has_talib:
            values = talib.RSI(df[price_col].values, timeperiod=period)
        else:
            # Fallback: simple RSI calculation
            delta = df[price_col].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period, min_periods=1).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period, min_periods=1).mean()
            rs = gain / loss.replace(0, np.nan)
            values = 100 - (100 / (1 + rs))
        result_df['RSI'] = values
    
    # === Bollinger Bands ===
    elif "Bollinger" in indicator_name:
        if has_talib:
            upper, middle, lower = talib.BBANDS(df[price_col].values, timeperiod=period)
        else:
            # Fallback: simple Bollinger Bands calculation
            middle = df[price_col].rolling(window=period, min_periods=1).mean()
            std = df[price_col].rolling(window=period, min_periods=1).std()
            upper = middle + (std * 2)
            lower = middle - (std * 2)
        
        if "Middle" in indicator_name:
            result_df['Real Middle Band'] = middle
        elif "Upper" in indicator_name:
            result_df['Real Upper Band'] = upper
        else:  # Lower Band
            result_df['Real Lower Band'] = lower
    
    # === ATR Indicator ===
    elif indicator_name == "ATR":
        if has_talib:
            values = talib.ATR(df['High'].values, df['Low'].values, df['Close'].values, timeperiod=period)
        else:
            # Fallback: simple ATR calculation
            high_low = df['High'] - df['Low']
            high_close = abs(df['High'] - df['Close'].shift())
            low_close = abs(df['Low'] - df['Close'].shift())
            true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            values = true_range.rolling(window=period, min_periods=1).mean()
        result_df['ATR'] = values
    
    # === VWMA Indicator ===
    elif indicator_name == "VWMA":
        if 'Volume' not in df.columns:
            logger.error("VWMA requires volume data")
            return None
        
        # Calculate VWMA: sum(price * volume) / sum(volume) over period
        values = (df[price_col] * df['Volume']).rolling(window=period, min_periods=1).sum() / \
                 df['Volume'].rolling(window=period, min_periods=1).sum()
        result_df['VWMA'] = values
    
    else:
        logger.error(f"Unknown indicator: {indicator_name}")
        return None
    
    # Drop rows with NaN in indicator columns
    indicator_cols = [col for col in result_df.columns if col != 'time']
    result_df = result_df.dropna(subset=indicator_cols)
    
    # Reset index
    result_df = result_df.reset_index(drop=True)
    
    return result_df
