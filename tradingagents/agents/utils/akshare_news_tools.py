"""
AkShare News Tools for Intraday Trading Agent
Provides direct access to Futu global news and other news sources
"""

import logging
from langchain_core.tools import tool
from typing import Annotated, Literal
import pandas as pd


@tool
def get_akshare_news(
    output_format: Annotated[Literal["markdown", "csv"], "Output format: 'markdown' or 'csv'"] = "markdown",
    limit: Annotated[int, "Maximum number of news items to return"] = 20,
) -> str:
    """
    Get latest global financial news from Futu (富途) using AkShare.
    
    This tool retrieves real-time global financial news from Futu's news feed,
    which includes breaking news, market updates, and important financial events.
    Ideal for intraday trading decisions as it provides the most recent market-moving news.
    
    Args:
        output_format: Format of the output - 'markdown' for readable text or 'csv' for structured data
        limit: Maximum number of news items to return (default: 20)
        
    Returns:
        str: Formatted news data in the specified format
        
    Example:
        >>> get_akshare_news(output_format="markdown", limit=10)
        ### 🐂 富途-全球资讯
        
        **Breaking: Fed Announces Rate Decision**
        *时间: 2025-11-06 14:30*
        The Federal Reserve announced...
    """
    try:
        # Import akshare dynamically
        try:
            import akshare as ak
        except ImportError:
            return "Error: akshare not installed. Please install with: pip install akshare"
        
        # Get Futu global news
        df_futu = ak.stock_info_global_futu()
        
        if df_futu is None or df_futu.empty:
            return "No news data available from Futu at this time."
        
        # Limit the number of results
        df_futu = df_futu.head(limit)
        
        # Identify column names (they may vary)
        cols = list(df_futu.columns)
        title_col = next((c for c in ['标题', 'title', '新闻标题', 'name'] if c in cols), None)
        content_col = next((c for c in ['内容', 'summary', '新闻内容', '摘录', '简介', 'desc', '描述'] if c in cols), None)
        date_col = next((c for c in ['时间', '发布时间', 'publish_time', 'date', '日期'] if c in cols), None)
        
        if output_format == "csv":
            # Return as CSV format
            try:
                # Select relevant columns if they exist
                relevant_cols = []
                if title_col:
                    relevant_cols.append(title_col)
                if date_col:
                    relevant_cols.append(date_col)
                if content_col:
                    relevant_cols.append(content_col)
                
                if relevant_cols:
                    df_output = df_futu[relevant_cols]
                else:
                    df_output = df_futu
                
                csv_output = df_output.to_csv(index=False)
                return f"Futu Global News (CSV format, {len(df_futu)} items):\n\n{csv_output}"
            except Exception as e:
                logging.error(f"Error converting to CSV: {e}")
                return f"Error converting news to CSV format: {str(e)}"
        
        else:  # markdown format
            result = f"### 🐂 富途-全球资讯 (Futu Global News)\n\n"
            result += f"**Total Items**: {len(df_futu)}\n"
            result += f"**Data Source**: AkShare - stock_info_global_futu()\n\n"
            result += "---\n\n"
            
            for idx, row in df_futu.iterrows():
                # Extract data with fallbacks
                title = row.get(title_col, 'No title') if title_col else 'No title'
                content = row.get(content_col, '') if content_col else ''
                pub_time = row.get(date_col, '') if date_col else ''
                
                # Format the news item
                result += f"**{idx + 1}. {title}**\n"
                
                if pub_time:
                    result += f"*时间: {pub_time}*\n"
                
                if content:
                    # Truncate long content
                    content_str = str(content)
                    if len(content_str) > 500:
                        result += f"{content_str[:500]}...\n"
                    else:
                        result += f"{content_str}\n"
                
                result += "\n"
            
            result += "---\n\n"
            result += "**Note**: This news feed is updated in real-time and is ideal for intraday trading decisions.\n"
            
            return result
    
    except Exception as e:
        error_msg = f"Error retrieving Futu global news: {str(e)}"
        logging.error(error_msg)
        return error_msg


@tool
def get_akshare_hot_stocks(
    symbol: Annotated[Literal["全部", "A股", "港股", "美股"], "Market symbol"] = "A股",
    time_range: Annotated[Literal["今日", "1小时"], "Time range for hot search"] = "今日",
    limit: Annotated[int, "Maximum number of hot stocks to return"] = 10,
) -> str:
    """
    Get current hot search stocks from Baidu Stock Market (百度股市通).
    
    This tool retrieves the most searched and trending stocks from Baidu,
    which can help identify new trading opportunities for intraday trading.
    
    Args:
        symbol: Market to query - "全部" (All), "A股" (A-shares), "港股" (HK), "美股" (US)
        time_range: Time range - "今日" (Today) or "1小时" (1 hour)
        limit: Maximum number of hot stocks to return (default: 10)
        
    Returns:
        str: Formatted list of hot search stocks with heat index and price changes
        
    Example:
        >>> get_akshare_hot_stocks(symbol="A股", time_range="今日", limit=5)
        ### 🔥 热搜股票 (Hot Search Stocks)
        
        1. **融发核电**
           涨跌幅: +1.72% | 综合热度: 866000
    """
    try:
        # Import required modules
        try:
            import akshare as ak
            from datetime import datetime
        except ImportError:
            return "Error: akshare not installed. Please install with: pip install akshare"
        
        # Get current date in required format
        today = datetime.now().strftime("%Y%m%d")
        
        # Fetch hot search stocks from Baidu
        try:
            df_hot = ak.stock_hot_search_baidu(symbol=symbol, date=today, time=time_range)
        except Exception as e:
            logging.error(f"Failed to fetch Baidu hot search data: {e}")
            return f"Error: Unable to retrieve hot search stocks from Baidu. {str(e)}"
        
        if df_hot is None or df_hot.empty:
            return f"No hot search stocks data available for {symbol} in {time_range}."
        
        # Limit the number of results
        df_hot = df_hot.head(limit)
        
        # Format the output
        result = f"### 🔥 热搜股票 (Hot Search Stocks)\n\n"
        result += f"**数据源**: 百度股市通 (Baidu Stock Market)\n"
        result += f"**市场**: {symbol}\n"
        result += f"**时间范围**: {time_range}\n"
        result += f"**更新时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        result += "---\n\n"
        
        for idx, row in df_hot.iterrows():
            rank = idx + 1
            name_code = row.get('名称/代码', 'N/A')
            change_pct = row.get('涨跌幅', 'N/A')
            heat = row.get('综合热度', 'N/A')
            
            result += f"{rank}. **{name_code}**\n"
            result += f"   涨跌幅: {change_pct} | 综合热度: {heat:,}\n\n"
        
        result += "---\n\n"
        result += "**说明**: 热度数据反映股票在百度的搜索热度，可用于发现市场关注焦点。\n"
        
        return result
    
    except Exception as e:
        error_msg = f"Error retrieving hot search stocks: {str(e)}"
        logging.error(error_msg)
        return error_msg
