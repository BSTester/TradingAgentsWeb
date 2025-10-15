import pandas as pd
import yfinance as yf
from stockstats import wrap
from typing import Annotated
import os
from .config import get_config, DATA_DIR


class StockstatsUtils:
    @staticmethod
    def get_stock_stats(
        symbol: Annotated[str, "ticker symbol for the company"],
        indicator: Annotated[
            str, "quantitative indicators based off of the stock data for the company"
        ],
        curr_date: Annotated[
            str, "curr date for retrieving stock price data, YYYY-mm-dd"
        ],
    ):
        # Get config and set up data directory path
        config = get_config()
        online = config["data_vendors"]["technical_indicators"] != "local"

        df = None
        data = None

        if not online:
            try:
                data = pd.read_csv(
                    os.path.join(
                        DATA_DIR,
                        f"{symbol}-YFin-data-2015-01-01-2025-03-25.csv",
                    )
                )
                df = wrap(data)
            except FileNotFoundError:
                raise Exception("Stockstats fail: Yahoo Finance data not fetched yet!")
        else:
            # Get today's date as YYYY-mm-dd to add to cache
            today_date = pd.Timestamp.today()
            curr_date = pd.to_datetime(curr_date)

            end_date = today_date
            start_date = today_date - pd.DateOffset(years=15)
            start_date = start_date.strftime("%Y-%m-%d")
            end_date = end_date.strftime("%Y-%m-%d")

            # Get config and ensure cache directory exists
            os.makedirs(config["data_cache_dir"], exist_ok=True)

            data_file = os.path.join(
                config["data_cache_dir"],
                f"{symbol}-YFin-data-{start_date}-{end_date}.csv",
            )

            if os.path.exists(data_file):
                data = pd.read_csv(data_file)
                data["Date"] = pd.to_datetime(data["Date"])
            else:
                data = yf.download(
                    symbol,
                    start=start_date,
                    end=end_date,
                    multi_level_index=False,
                    progress=False,
                    auto_adjust=True,
                )
                data = data.reset_index()
                data.to_csv(data_file, index=False)

            df = wrap(data)
            df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")
            curr_date = curr_date.strftime("%Y-%m-%d")

        df[indicator]  # trigger stockstats to calculate the indicator
        
        # 修复日期匹配逻辑
        # 将curr_date转换为pandas的datetime对象进行精确匹配
        curr_date_dt = pd.to_datetime(curr_date)
        
        # 确保df中的Date列也是datetime类型
        if df["Date"].dtype == 'object':
            df["Date"] = pd.to_datetime(df["Date"])
        
        # 进行精确的日期匹配
        matching_rows = df[df["Date"].dt.date == curr_date_dt.date()]

        if not matching_rows.empty:
            indicator_value = matching_rows[indicator].values[0]
            return indicator_value
        else:
            # 如果找不到精确匹配，尝试查找最近的交易日
            available_dates = df["Date"].dt.date
            closest_date = None
            min_diff = float('inf')
            
            for avail_date in available_dates:
                diff = abs((curr_date_dt.date() - avail_date).days)
                if diff < min_diff and avail_date <= curr_date_dt.date():
                    min_diff = diff
                    closest_date = avail_date
            
            if closest_date is not None and min_diff <= 7:  # 7天内的数据有效
                closest_rows = df[df["Date"].dt.date == closest_date]
                if not closest_rows.empty:
                    indicator_value = closest_rows[indicator].values[0]
                    return indicator_value
            
            return "N/A: Not a trading day (weekend or holiday)"
