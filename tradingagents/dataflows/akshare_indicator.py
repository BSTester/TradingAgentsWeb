"""
AkShare Technical Indicators
Calculate technical indicators using AKShare (compatible with Alpha Vantage interface)
"""

import logging
import pandas as pd
from datetime import datetime, timedelta
from typing import Annotated
import time

from .akshare_common import _identify_market, MARKET_PATTERNS, get_akshare


def get_indicators(
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
    - kdj: KDJ indicator (AkShare specific)
    
    Args:
        symbol: Stock symbol
        indicator: Technical indicator name (see supported list above)
        curr_date: Current date in YYYY-MM-DD format
        look_back_days: Number of days to look back
        interval: Time interval (daily, weekly, monthly) - currently only daily supported
        time_period: Number of periods for calculation (e.g., 14 for RSI-14, 50 for SMA-50)
        series_type: Price type to use (close, open, high, low)
    
    Returns:
        Formatted string with indicator values
    """
    ak = get_akshare()
    if not ak:
        return "Error: akshare not installed"
    
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
        "kdj": "KDJ: A momentum indicator combining K, D, and J lines. Usage: Identify overbought/oversold conditions and trend reversals. Tips: Popular in Asian markets; use with other indicators for confirmation."
    }
    
    try:
        # Import stock data function
        from .akshare_stock import get_stock
        
        # Get historical data for indicator calculation
        end_date = curr_date
        # Add extra days for indicator calculation warmup
        extra_days = max(200, time_period * 3)
        start_date_dt = datetime.strptime(curr_date, "%Y-%m-%d") - timedelta(days=look_back_days + extra_days)
        start_date = start_date_dt.strftime("%Y-%m-%d")
        
        # Get price data with retries
        attempts = 3
        price_data_str = ""
        for i in range(attempts):
            price_data_str = get_stock(symbol, start_date, end_date)
            if not (price_data_str.startswith("Error") or price_data_str.startswith("No data")):
                break
            if i < attempts - 1:
                time.sleep(1.0)
        
        if price_data_str.startswith("Error") or price_data_str.startswith("No data"):
            # Fallback: try yfinance
            try:
                import yfinance as yf
                mk = _identify_market(symbol)
                yf_symbol = symbol
                if mk == 'A_STOCK':
                    s = symbol.strip()
                    if s.startswith(('60', '68')):
                        yf_symbol = f"{s}.SS"
                    elif s.startswith(('00', '30')):
                        yf_symbol = f"{s}.SZ"
                elif mk == 'HK_STOCK':
                    s = symbol.upper()
                    if s.endswith('.HK'):
                        s = s[:-3]
                    try:
                        s4 = str(int(s)).zfill(4)
                    except Exception:
                        s4 = s[-4:]
                    yf_symbol = f"{s4}.HK"
                else:
                    yf_symbol = symbol.upper()

                df_yf = yf.download(yf_symbol, start=start_date, end=end_date, interval="1d", progress=False, auto_adjust=False)
                if df_yf is not None and not df_yf.empty:
                    df_yf = df_yf.reset_index()
                    df_yf = df_yf.rename(columns={
                        'Date': 'Date',
                        'Open': 'Open',
                        'High': 'High',
                        'Low': 'Low',
                        'Close': 'Close',
                        'Volume': 'Volume'
                    })
                    csv_string = df_yf[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']].to_csv(index=False)
                    header = f"# Stock data for {symbol} from {start_date} to {end_date} (yfinance fallback)\n"
                    header += f"# Market: {MARKET_PATTERNS[mk]['description']}\n"
                    header += f"# Total records: {len(df_yf)}\n"
                    header += f"# Retrieved: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                    price_data_str = header + csv_string
                else:
                    return price_data_str
            except Exception:
                return price_data_str
        
        # Parse CSV data
        lines = price_data_str.split('\n')
        csv_start = 0
        for i, line in enumerate(lines):
            if line.startswith('Date') or line.startswith('日期'):
                csv_start = i
                break
        
        csv_data = '\n'.join(lines[csv_start:])
        from io import StringIO
        df = pd.read_csv(StringIO(csv_data))
        
        if df.empty:
            return f"No price data available for indicator calculation"
        
        # Get price series based on series_type
        series_type_map = {
            'close': 'Close',
            'open': 'Open',
            'high': 'High',
            'low': 'Low'
        }
        price_col = series_type_map.get(series_type.lower(), 'Close')
        
        # Fallback to Chinese column names if English not found
        if price_col not in df.columns:
            chinese_map = {
                'Close': '收盘',
                'Open': '开盘',
                'High': '最高',
                'Low': '最低'
            }
            price_col = chinese_map.get(price_col, '收盘')
        
        # Calculate indicators based on type
        indicator_lower = indicator.lower()
        
        # === SMA Indicators ===
        if indicator_lower in ['close_50_sma', 'close_200_sma']:
            period = 50 if indicator_lower == 'close_50_sma' else 200
            price_series = df[price_col]
            
            try:
                import talib
                sma_data = talib.SMA(price_series.values, timeperiod=period)
            except Exception:
                # Fallback: pandas SMA
                sma_data = price_series.rolling(window=period, min_periods=1).mean()
            
            result_df = pd.DataFrame({
                'Date': df['Date'] if 'Date' in df.columns else df['日期'],
                'SMA': sma_data
            })
            
        # === EMA Indicators ===
        elif indicator_lower == 'close_10_ema':
            period = time_period if time_period != 14 else 10
            price_series = df[price_col]
            
            try:
                import talib
                ema_data = talib.EMA(price_series.values, timeperiod=period)
            except Exception:
                # Fallback: pandas EMA
                ema_data = price_series.ewm(span=period, adjust=False).mean()
            
            result_df = pd.DataFrame({
                'Date': df['Date'] if 'Date' in df.columns else df['日期'],
                'EMA': ema_data
            })
        
        # === MACD Indicators ===
        elif indicator_lower in ['macd', 'macds', 'macdh']:
            close_series = df[price_col]
            
            try:
                import talib
                macd, signal, histogram = talib.MACD(close_series.values)
                macd_data = pd.DataFrame({
                    'MACD': macd,
                    'Signal': signal,
                    'Histogram': histogram
                })
            except Exception:
                # Fallback: simple MACD calculation
                exp1 = close_series.ewm(span=12, adjust=False).mean()
                exp2 = close_series.ewm(span=26, adjust=False).mean()
                macd_line = exp1 - exp2
                signal_line = macd_line.ewm(span=9, adjust=False).mean()
                histogram = macd_line - signal_line
                macd_data = pd.DataFrame({
                    'MACD': macd_line,
                    'Signal': signal_line,
                    'Histogram': histogram
                })
            
            # Return specific component based on indicator
            date_col = df['Date'] if 'Date' in df.columns else df['日期']
            if indicator_lower == 'macd':
                result_df = pd.DataFrame({
                    'Date': date_col,
                    'MACD': macd_data['MACD']
                })
            elif indicator_lower == 'macds':
                result_df = pd.DataFrame({
                    'Date': date_col,
                    'MACD_Signal': macd_data['Signal']
                })
            else:  # macdh
                result_df = pd.DataFrame({
                    'Date': date_col,
                    'MACD_Hist': macd_data['Histogram']
                })
            
        # === RSI Indicator ===
        elif indicator_lower == 'rsi':
            price_series = df[price_col]
            
            try:
                import talib
                rsi_data = talib.RSI(price_series.values, timeperiod=time_period)
            except Exception:
                # Fallback: simple RSI calculation
                delta = price_series.diff()
                gain = (delta.where(delta > 0, 0)).rolling(window=time_period, min_periods=1).mean()
                loss = (-delta.where(delta < 0, 0)).rolling(window=time_period, min_periods=1).mean()
                rs = gain / loss.replace(0, pd.NA)
                rsi_data = 100 - (100 / (1 + rs))
            
            result_df = pd.DataFrame({
                'Date': df['Date'] if 'Date' in df.columns else df['日期'],
                'RSI': rsi_data
            })
            
        # === Bollinger Bands ===
        elif indicator_lower in ['boll', 'boll_ub', 'boll_lb']:
            close_series = df[price_col]
            
            try:
                import talib
                upper, middle, lower = talib.BBANDS(close_series.values, timeperiod=20)
                boll_data = pd.DataFrame({'Upper': upper, 'Middle': middle, 'Lower': lower})
            except Exception:
                # Fallback: simple Bollinger Bands calculation
                middle = close_series.rolling(window=20, min_periods=1).mean()
                std = close_series.rolling(window=20, min_periods=1).std()
                upper = middle + (std * 2)
                lower = middle - (std * 2)
                boll_data = pd.DataFrame({'Upper': upper, 'Middle': middle, 'Lower': lower})
            
            # Return specific band based on indicator
            date_col = df['Date'] if 'Date' in df.columns else df['日期']
            if indicator_lower == 'boll':
                result_df = pd.DataFrame({
                    'Date': date_col,
                    'Real Middle Band': boll_data['Middle']
                })
            elif indicator_lower == 'boll_ub':
                result_df = pd.DataFrame({
                    'Date': date_col,
                    'Real Upper Band': boll_data['Upper']
                })
            else:  # boll_lb
                result_df = pd.DataFrame({
                    'Date': date_col,
                    'Real Lower Band': boll_data['Lower']
                })
        
        # === ATR Indicator ===
        elif indicator_lower == 'atr':
            high_series = df['High'] if 'High' in df.columns else df['最高']
            low_series = df['Low'] if 'Low' in df.columns else df['最低']
            close_series = df['Close'] if 'Close' in df.columns else df['收盘']
            
            try:
                import talib
                atr_data = talib.ATR(high_series.values, low_series.values, close_series.values, timeperiod=time_period)
            except Exception:
                # Fallback: simple ATR calculation
                high_low = high_series - low_series
                high_close = abs(high_series - close_series.shift())
                low_close = abs(low_series - close_series.shift())
                true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
                atr_data = true_range.rolling(window=time_period, min_periods=1).mean()
            
            result_df = pd.DataFrame({
                'Date': df['Date'] if 'Date' in df.columns else df['日期'],
                'ATR': atr_data
            })
            
        # === KDJ Indicator (AkShare specific) ===
        elif indicator_lower == 'kdj':
            high_series = df['High'] if 'High' in df.columns else df['最高']
            low_series = df['Low'] if 'Low' in df.columns else df['最低']
            close_series = df['Close'] if 'Close' in df.columns else df['收盘']
            
            try:
                import talib
                k_percent, d_percent = talib.STOCH(high_series.values, low_series.values, close_series.values)
                j_percent = 3 * k_percent - 2 * d_percent
                kdj_data = pd.DataFrame({'K': k_percent, 'D': d_percent, 'J': j_percent})
            except Exception:
                # Fallback: simple KDJ calculation
                low_min = low_series.rolling(window=9, min_periods=1).min()
                high_max = high_series.rolling(window=9, min_periods=1).max()
                rsv = (close_series - low_min) / (high_max - low_min).replace(0, pd.NA) * 100
                k_percent = rsv.ewm(alpha=1 / 3, adjust=False).mean()
                d_percent = k_percent.ewm(alpha=1 / 3, adjust=False).mean()
                j_percent = 3 * k_percent - 2 * d_percent
                kdj_data = pd.DataFrame({'K': k_percent, 'D': d_percent, 'J': j_percent})
            
            result_df = pd.DataFrame({
                'Date': df['Date'] if 'Date' in df.columns else df['日期'],
                'K': kdj_data['K'],
                'D': kdj_data['D'],
                'J': kdj_data['J']
            })
            
        else:
            supported = ["close_50_sma", "close_200_sma", "close_10_ema", "macd", "macds", "macdh",
                        "rsi", "boll", "boll_ub", "boll_lb", "atr", "kdj"]
            return f"Indicator '{indicator}' not supported. Available: {', '.join(supported)}"
        
        # Filter to requested date range
        result_df['Date'] = pd.to_datetime(result_df['Date'])
        end_date_dt = datetime.strptime(curr_date, "%Y-%m-%d")
        start_date_dt = end_date_dt - timedelta(days=look_back_days)
        
        filtered_df = result_df[
            (result_df['Date'] >= start_date_dt) &
            (result_df['Date'] <= end_date_dt)
        ].copy()
        
        if filtered_df.empty:
            # Fallback: use the last N rows
            n = max(1, min(look_back_days, len(result_df)))
            filtered_df = result_df.tail(n).copy()
        
        # Drop rows with invalid dates
        filtered_df = filtered_df.dropna(subset=['Date'])
        
        # Sort by date ascending
        filtered_df = filtered_df.sort_values('Date')
        
        # Format output
        ind_string = ""
        for _, row in filtered_df.iterrows():
            date_val = row['Date']
            try:
                date_str = date_val.strftime('%Y-%m-%d') if hasattr(date_val, 'strftime') and not pd.isna(date_val) else str(date_val)[:10]
            except Exception:
                date_str = str(date_val)
            
            # Get the value(s) for this row
            values = []
            for col in filtered_df.columns:
                if col != 'Date':
                    try:
                        value = float(row[col])
                        # Format with appropriate precision
                        if abs(value) < 0.01:
                            values.append(f"{value:.6f}")
                        else:
                            values.append(f"{value:.4f}")
                    except Exception:
                        values.append(str(row[col]))
            
            # Single value per line
            if len(values) == 1:
                ind_string += f"{date_str}: {values[0]}\n"
            else:
                # Multiple values (for KDJ or full MACD)
                ind_string += f"{date_str}: {', '.join(values)}\n"
        
        if not ind_string:
            ind_string = "No data available for the specified date range.\n"
        
        # Build result string
        result_str = (
            f"## {indicator.upper()} values for {symbol} from {start_date_dt.strftime('%Y-%m-%d')} to {curr_date}:\n\n"
            + ind_string
            + "\n\n"
            + indicator_descriptions.get(indicator_lower, "No description available.")
        )
        
        return result_str
        
    except Exception as e:
        return f"Error calculating {indicator} for {symbol}: {str(e)}"
