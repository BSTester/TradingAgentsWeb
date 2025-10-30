"""
AkShare News and Sentiment Data
Get news, insider transactions, and sentiment data
"""

import logging
import pandas as pd
from datetime import datetime, timedelta
from typing import Annotated

from .akshare_common import _identify_market, normalize_symbol_for_hk, MARKET_PATTERNS, get_akshare


def get_news(ticker, start_date, end_date) -> str:
    """
    Get stock news with multi-source priority:
    1. EastMoney news
    2. Other available sources
    
    Args:
        ticker: Stock symbol or search query
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        
    Returns:
        Formatted string with news articles
    """
    ak = get_akshare()
    if not ak:
        return "Error: akshare not installed"
    
    try:
        market = _identify_market(ticker)

        # Normalize symbol for AKShare news API across markets
        if market == 'HK_STOCK':
            symbol_for_ak = normalize_symbol_for_hk(ticker)
        elif market == 'US_STOCK':
            symbol_for_ak = ticker.upper()
        else:
            symbol_for_ak = ticker

        # Unified: stock_news_em supports all markets
        news_data = ak.stock_news_em(symbol=symbol_for_ak)
        if not isinstance(news_data, pd.DataFrame) or news_data.empty:
            return f"No news found for {ticker}"

        # Standardize columns and filter by date range if possible
        title_col = next((c for c in ['新闻标题', 'title', '标题'] if c in news_data.columns), None)
        content_col = next((c for c in ['新闻内容', 'content', '摘要'] if c in news_data.columns), None)
        date_col = next((c for c in ['发布时间', 'publish_time', 'date', '时间'] if c in news_data.columns), None)
        if date_col is not None:
            # Try to coerce to datetime
            news_data[date_col] = pd.to_datetime(news_data[date_col], errors='coerce')
            sdt = pd.to_datetime(start_date, errors='coerce')
            edt = pd.to_datetime(end_date, errors='coerce')
            if pd.notna(sdt) and pd.notna(edt):
                news_data = news_data[(news_data[date_col] >= sdt) & (news_data[date_col] <= edt)]

        result = f"## News for {ticker} (AKShare-EastMoney)\n\n"
        for _, row in news_data.head(10).iterrows():  # Limit to 10 recent news
            title = row.get(title_col, row.get('title', 'No title')) if title_col else row.get('title', 'No title')
            content = row.get(content_col, row.get('content', '')) if content_col else row.get('content', '')
            pub_date = row.get(date_col, row.get('publish_time', '')) if date_col else row.get('publish_time', '')

            result += f"### {title}\n"
            if pub_date is not None and pub_date != '':
                result += f"**Date:** {pub_date}\n"
            if content:
                result += f"{str(content)[:500]}...\n"  # Truncate long content
            result += "\n"

        return result
            
    except Exception as e:
        return f"Error retrieving news for {ticker}: {str(e)}"


def get_insider_transactions(symbol) -> str:
    """
    Get insider transaction data from AKShare
    
    For A-shares: Uses shareholder change data (股东持股变动)
    For US/HK stocks: Not supported by AKShare, use Alpha Vantage or yfinance instead
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Formatted string with insider transaction data
    """
    ak = get_akshare()
    if not ak:
        return "Error: akshare not installed"
    
    try:
        market = _identify_market(symbol)
        
        if market == 'A_STOCK':
            # Try to get shareholder change data (股东持股变动)
            try:
                df = ak.stock_shareholder_change_ths(symbol=symbol)
                if not df.empty:
                    result = f"## Insider Transactions for {symbol} (Shareholder Changes)\n\n"
                    result += f"**Data Source**: 同花顺-股东持股变动\n"
                    result += f"**Total Records**: {len(df)}\n\n"
                    
                    # Show recent changes (last 10)
                    recent_df = df.head(10)
                    
                    result += "### Recent Shareholder Changes:\n\n"
                    for _, row in recent_df.iterrows():
                        date = row.get('公告日期', row.get('date', 'N/A'))
                        holder = row.get('变动股东', row.get('shareholder', 'N/A'))
                        change = row.get('变动数量', row.get('change_amount', 'N/A'))
                        price = row.get('交易均价', row.get('avg_price', 'N/A'))
                        remaining = row.get('剩余股份总数', row.get('remaining_shares', 'N/A'))
                        method = row.get('变动途径', row.get('change_method', 'N/A'))
                        
                        result += f"**{date}**\n"
                        result += f"- Shareholder: {holder}\n"
                        result += f"- Change: {change}\n"
                        result += f"- Avg Price: {price}\n"
                        result += f"- Remaining Shares: {remaining}\n"
                        if method and method != 'N/A':
                            result += f"- Method: {method}\n"
                        result += "\n"
                    
                    return result
            except Exception as e:
                logging.warning(f"stock_shareholder_change_ths failed: {e}")
            
            # Fallback: Try to get main stockholder data
            try:
                df = ak.stock_main_stock_holder(stock=symbol)
                if not df.empty:
                    result = f"## Insider Transactions for {symbol} (Main Stockholders)\n\n"
                    result += f"**Data Source**: 新浪财经-主要股东\n"
                    result += f"**Total Records**: {len(df)}\n\n"
                    
                    # Show top 10 stockholders
                    top_df = df.head(10)
                    
                    result += "### Top Stockholders:\n\n"
                    for _, row in top_df.iterrows():
                        num = row.get('编号', row.get('number', 'N/A'))
                        name = row.get('股东名称', row.get('name', 'N/A'))
                        shares = row.get('持股数量', row.get('shares', 'N/A'))
                        ratio = row.get('持股比例', row.get('ratio', 'N/A'))
                        date = row.get('截至日期', row.get('date', 'N/A'))
                        
                        result += f"**{num}. {name}**\n"
                        result += f"- Shares: {shares}\n"
                        result += f"- Ratio: {ratio}%\n"
                        result += f"- As of: {date}\n\n"
                    
                    return result
            except Exception as e:
                logging.warning(f"stock_main_stock_holder failed: {e}")
            
            return f"No insider transaction data available for {symbol}"
        
        elif market == 'US_STOCK':
            return (
                f"Insider transactions not supported for US stocks in AKShare.\n\n"
                f"**Recommendation**: Use Alpha Vantage's `get_insider_transactions` function:\n"
                f"- Provides official SEC Form 4 filings\n"
                f"- Covers all US public companies\n"
                f"- Real-time insider transaction data\n\n"
                f"Alternative: Use yfinance's `insider_transactions` property."
            )
        
        elif market == 'HK_STOCK':
            return (
                f"Insider transactions not supported for HK stocks in AKShare.\n\n"
                f"**Recommendation**: Use yfinance or other data sources:\n"
                f"- HKEx provides director dealings data\n"
                f"- yfinance may have limited insider data for HK stocks\n\n"
                f"Note: HK market has different disclosure requirements than US markets."
            )
        
        else:
            return f"Insider transactions not supported for market: {MARKET_PATTERNS.get(market, {}).get('description', 'Unknown')}"
            
    except Exception as e:
        return f"Error retrieving insider transactions for {symbol}: {str(e)}"


def get_global_news(curr_date, look_back_days=7, limit=10) -> str:
    """
    聚合所有可用渠道的全球财经信息（不按优先级，全部尝试获取并汇总）
    
    Args:
        curr_date: Current date in YYYY-MM-DD format
        look_back_days: Number of days to look back (default: 7)
        limit: Maximum number of news items (default: 10)
        
    Returns:
        Formatted string with global financial news
    """
    ak = get_akshare()
    if not ak:
        return "Error: akshare not installed"
    
    try:
        # Convert date format for AKShare
        curr_date_ak = curr_date.replace("-", "")
        
        # Initialize result with header
        result = f"## Global Financial News ({curr_date})\n\n"
        
        # 1. Get Wallstreetcn Macro Calendar (华尔街见闻-日历-宏观) - Highest Priority
        try:
            df_macro_ws = ak.macro_info_ws(date=curr_date_ak)
            if not df_macro_ws.empty:
                result += "### 📊 华尔街见闻-宏观日历\n\n"
                # Sort by importance if available
                if '重要性' in df_macro_ws.columns:
                    df_macro_ws_sorted = df_macro_ws.sort_values('重要性', ascending=False)
                else:
                    df_macro_ws_sorted = df_macro_ws
                
                for _, row in df_macro_ws_sorted.head(limit).iterrows():
                    time_str = row.get('时间', row.get('time', ''))
                    region = row.get('地区', row.get('region', ''))
                    event = row.get('事件', row.get('event', ''))
                    importance = row.get('重要性', row.get('importance', ''))
                    current_val = row.get('今值', row.get('current', ''))
                    expected_val = row.get('预期', row.get('expected', ''))
                    previous_val = row.get('前值', row.get('previous', ''))
                    
                    # Format importance indicator
                    importance_indicator = ""
                    if importance:
                        if str(importance) == "3" or "高" in str(importance):
                            importance_indicator = "🔴 高"
                        elif str(importance) == "2" or "中" in str(importance):
                            importance_indicator = "🟡 中"
                        elif str(importance) == "1" or "低" in str(importance):
                            importance_indicator = "🟢 低"
                        else:
                            importance_indicator = f"📈 {importance}"
                    
                    result += f"**{time_str} | {region} | {event}**"
                    if importance_indicator:
                        result += f" {importance_indicator}"
                    result += "\n"
                    
                    if current_val or expected_val or previous_val:
                        result += f"今值: {current_val} | 预期: {expected_val} | 前值: {previous_val}\n"
                    result += "\n"
                result += "---\n\n"
        except Exception as e:
            logging.warning(f"Failed to get Wallstreetcn macro calendar: {str(e)}")
        
        # 2. Get CCTV News (新闻联播) - High Priority
        try:
            df_cctv = ak.news_cctv(date=curr_date_ak)
            if not df_cctv.empty:
                result += "### 📺 央视新闻联播\n\n"
                for _, row in df_cctv.head(limit).iterrows():
                    title = row.get('title', 'No title')
                    content = row.get('content', '')
                    date = row.get('date', curr_date_ak)
                    
                    result += f"**{title}**\n"
                    result += f"*日期: {date}*\n"
                    if content:
                        result += f"{content[:500]}...\n" if len(content) > 500 else f"{content}\n"
                    result += "\n"
                result += "---\n\n"
        except Exception as e:
            logging.warning(f"Failed to get CCTV news: {str(e)}")
        
        # 3. Get Economic News from Baidu (百度财经新闻)
        try:
            df_baidu_econ = ak.news_economic_baidu()
            if not df_baidu_econ.empty:
                result += "### 📰 百度财经新闻\n\n"
                for _, row in df_baidu_econ.head(limit).iterrows():
                    title = row.get('新闻标题', row.get('title', 'No title'))
                    content = row.get('新闻内容', row.get('content', ''))
                    pub_time = row.get('发布时间', row.get('publish_time', ''))
                    
                    result += f"**{title}**\n"
                    if pub_time:
                        result += f"*时间: {pub_time}*\n"
                    if content:
                        result += f"{content[:300]}...\n" if len(content) > 300 else f"{content}\n"
                    result += "\n"
                result += "---\n\n"
        except Exception as e:
            logging.warning(f"Failed to get Baidu economic news: {str(e)}")
        
        # 4. Get EastMoney Stock News (东方财富股票新闻)
        try:
            df_em_stock = ak.stock_news_em()
            if not df_em_stock.empty:
                result += "### 📈 东方财富股票新闻\n\n"
                for _, row in df_em_stock.head(limit).iterrows():
                    title = row.get('新闻标题', row.get('title', 'No title'))
                    content = row.get('新闻内容', row.get('content', ''))
                    pub_time = row.get('发布时间', row.get('publish_time', ''))
                    
                    result += f"**{title}**\n"
                    if pub_time:
                        result += f"*时间: {pub_time}*\n"
                    if content:
                        result += f"{content[:300]}...\n" if len(content) > 300 else f"{content}\n"
                    result += "\n"
                result += "---\n\n"
        except Exception as e:
            logging.warning(f"Failed to get EastMoney stock news: {str(e)}")
        
        # 5. Get EastMoney Financial News (东方财富财经新闻 - 财经早知道)
        try:
            df_cjzc = ak.stock_info_cjzc_em()
            if not df_cjzc.empty:
                result += "### 💼 东方财富-财经早知道\n\n"
                for _, row in df_cjzc.head(limit).iterrows():
                    # Try different column names
                    title = row.get('标题', row.get('title', row.get('新闻标题', 'No title')))
                    content = row.get('内容', row.get('content', row.get('新闻内容', '')))
                    pub_time = row.get('时间', row.get('发布时间', row.get('publish_time', '')))
                    
                    result += f"**{title}**\n"
                    if pub_time:
                        result += f"*时间: {pub_time}*\n"
                    if content:
                        result += f"{str(content)[:300]}...\n" if len(str(content)) > 300 else f"{content}\n"
                    result += "\n"
                result += "---\n\n"
        except Exception as e:
            logging.warning(f"Failed to get EastMoney CJZC news: {str(e)}")
        
        # 6. Get EastMoney Global News (东方财富全球财经新闻)
        try:
            df_global_em = ak.stock_info_global_em()
            if not df_global_em.empty:
                result += "### 🌍 东方财富-全球财经\n\n"
                for _, row in df_global_em.head(limit).iterrows():
                    title = row.get('标题', row.get('title', row.get('新闻标题', 'No title')))
                    content = row.get('内容', row.get('content', row.get('摘要', '')))
                    pub_time = row.get('时间', row.get('发布时间', row.get('publish_time', '')))
                    
                    result += f"**{title}**\n"
                    if pub_time:
                        result += f"*时间: {pub_time}*\n"
                    if content:
                        result += f"{str(content)[:300]}...\n" if len(str(content)) > 300 else f"{content}\n"
                    result += "\n"
                result += "---\n\n"
        except Exception as e:
            logging.warning(f"Failed to get EastMoney global news: {str(e)}")
        
        # 7. Get Futu Global News (富途全球新闻)
        try:
            df_futu = ak.stock_info_global_futu()
            if not df_futu.empty:
                result += "### 🐂 富途-全球资讯\n\n"
                for _, row in df_futu.head(limit).iterrows():
                    # Futu may have different column structure
                    cols = list(df_futu.columns)
                    title_col = next((c for c in ['标题', 'title', '新闻标题', 'name'] if c in cols), None)
                    content_col = next((c for c in ['内容', 'summary', '新闻内容', '摘录', '简介', 'desc'] if c in cols), None)
                    date_col = next((c for c in ['时间', '发布时间', 'publish_time', 'date'] if c in cols), None)
                    
                    title = row.get(title_col, 'No title') if title_col else 'No title'
                    content = row.get(content_col, '') if content_col else ''
                    pub_time = row.get(date_col, '') if date_col else ''
                    
                    result += f"**{title}**\n"
                    if pub_time:
                        result += f"*时间: {pub_time}*\n"
                    if content:
                        result += f"{str(content)[:300]}...\n" if len(str(content)) > 300 else f"{content}\n"
                    result += "\n"
                result += "---\n\n"
        except Exception as e:
            logging.warning(f"Failed to get Futu global news: {str(e)}")
        
        # 8. Get CLS Global News (财联社全球新闻)
        try:
            df_cls = ak.stock_info_global_cls(symbol="全部")
            if not df_cls.empty:
                result += "### 📡 财联社-全球资讯\n\n"
                for _, row in df_cls.head(limit).iterrows():
                    cols = list(df_cls.columns)
                    title_col = next((c for c in ['标题', 'title', '新闻标题'] if c in cols), None)
                    content_col = next((c for c in ['内容', 'content', '新闻内容', '摘要'] if c in cols), None)
                    date_col = next((c for c in ['时间', '发布时间', 'publish_time', 'date'] if c in cols), None)
                    
                    title = row.get(title_col, 'No title') if title_col else 'No title'
                    content = row.get(content_col, '') if content_col else ''
                    pub_time = row.get(date_col, '') if date_col else ''
                    
                    result += f"**{title}**\n"
                    if pub_time:
                        result += f"*时间: {pub_time}*\n"
                    if content:
                        result += f"{str(content)[:300]}...\n" if len(str(content)) > 300 else f"{content}\n"
                    result += "\n"
                result += "---\n\n"
        except Exception as e:
            logging.warning(f"Failed to get CLS global news: {str(e)}")
        
        # Try to get news from previous days if look_back_days > 0
        if look_back_days > 0:
            curr_date_dt = datetime.strptime(curr_date, "%Y-%m-%d")
            
            for i in range(1, min(look_back_days + 1, 4)):  # Limit to 3 previous days
                try:
                    prev_date = curr_date_dt - timedelta(days=i)
                    prev_date_ak = prev_date.strftime("%Y%m%d")
                    
                    # Try to get macro calendar for previous days
                    try:
                        df_prev_macro = ak.macro_info_ws(date=prev_date_ak)
                        if not df_prev_macro.empty:
                            # Add only the most important event from previous days
                            if '重要性' in df_prev_macro.columns:
                                top_event = df_prev_macro.sort_values('重要性', ascending=False).iloc[0]
                            else:
                                top_event = df_prev_macro.iloc[0]
                            
                            result += f"### 📊 华尔街见闻-宏观日历 ({prev_date.strftime('%Y-%m-%d')})\n\n"
                            event_name = top_event.get('事件', top_event.get('event', 'No event'))
                            region = top_event.get('地区', top_event.get('region', ''))
                            result += f"**{region} | {event_name}**\n"
                            
                            current_val = top_event.get('今值', top_event.get('current', ''))
                            expected_val = top_event.get('预期', top_event.get('expected', ''))
                            previous_val = top_event.get('前值', top_event.get('previous', ''))
                            if current_val or expected_val or previous_val:
                                result += f"今值: {current_val} | 预期: {expected_val} | 前值: {previous_val}\n"
                            result += "\n"
                    except Exception as e:
                        logging.warning(f"Failed to get macro calendar for {prev_date_ak}: {str(e)}")
                    
                    # Also get CCTV news for previous days
                    df_prev_cctv = ak.news_cctv(date=prev_date_ak)
                    if not df_prev_cctv.empty:
                        # Add only the top story from previous days
                        top_story = df_prev_cctv.iloc[0]
                        result += f"### 📺 央视新闻联播 ({prev_date.strftime('%Y-%m-%d')})\n\n"
                        result += f"**{top_story.get('title', 'No title')}**\n"
                        content = top_story.get('content', '')
                        if content:
                            result += f"{content[:300]}...\n" if len(content) > 300 else f"{content}\n"
                        result += "\n"
                except Exception as e:
                    logging.warning(f"Failed to get news for {prev_date_ak}: {str(e)}")
                    continue
        
        # Summary section
        result += "### 📋 数据源总结\n\n"
        result += "本次获取的全球新闻数据包含以下来源：\n"
        result += "- 📊 华尔街见闻宏观日历\n"
        result += "- 📺 央视新闻联播\n"
        result += "- 📰 百度财经新闻\n"
        result += "- 📈 东方财富股票新闻\n"
        result += "- 💼 东方财富财经早知道\n"
        result += "- 🌍 东方财富全球财经\n"
        result += "- 🐂 富途全球资讯\n"
        result += "- 📡 财联社全球资讯\n"
        
        return result if len(result) > 50 else f"No global news data available for the specified period"
            
    except Exception as e:
        return f"Error fetching global news: {str(e)}"


def get_insider_sentiment(ticker, curr_date) -> str:
    """
    Get insider sentiment analysis using AKShare (approximated through various indicators)
    
    For A-shares: Uses fund flow, dragon-tiger list, and other market indicators
    For US/HK stocks: Not supported by AKShare
    
    Args:
        ticker: Stock symbol
        curr_date: Current date in YYYY-MM-DD format
        
    Returns:
        Formatted string with insider sentiment analysis
    """
    ak = get_akshare()
    if not ak:
        return "Error: akshare not installed"
    
    try:
        market = _identify_market(ticker)
        
        if market == 'A_STOCK':
            sentiment_data = {}
            
            # 1. Get insider transactions (high-level executives buying/selling)
            try:
                feature_df = ak.stock_individual_fund_flow(symbol=ticker)
                if not feature_df.empty:
                    insider_cols = [col for col in feature_df.columns if '高管' in col or '内部' in col]
                    if insider_cols:
                        recent_insider = feature_df[insider_cols].tail(5).sum().sum()
                        sentiment_data['insider_transactions'] = recent_insider
            except:
                sentiment_data['insider_transactions'] = "N/A"
            
            # 2. Get fund flow data (institutional sentiment)
            try:
                fund_flow_df = ak.stock_individual_fund_flow_rank()
                if not fund_flow_df.empty:
                    symbol_flow = fund_flow_df[fund_flow_df['代码'] == ticker]
                    if not symbol_flow.empty:
                        sentiment_data['main_fund_flow'] = symbol_flow.iloc[0]['主力净流入-净额']
                        sentiment_data['main_fund_flow_pct'] = symbol_flow.iloc[0]['主力净流入-净占比']
            except:
                sentiment_data['main_fund_flow'] = "N/A"
                sentiment_data['main_fund_flow_pct'] = "N/A"
            
            # 3. Get dragon-tiger list data (hot money sentiment)
            try:
                curr_date_ak = curr_date.replace("-", "")
                lhb_df = ak.stock_lhb_detail_em(curr_date_ak)
                if not lhb_df.empty:
                    symbol_lhb = lhb_df[lhb_df['代码'] == ticker]
                    if not symbol_lhb.empty:
                        sentiment_data['lhb_buy_amount'] = symbol_lhb['买入金额'].sum()
                        sentiment_data['lhb_sell_amount'] = symbol_lhb['卖出金额'].sum()
                        sentiment_data['lhb_net_amount'] = sentiment_data['lhb_buy_amount'] - sentiment_data['lhb_sell_amount']
            except:
                sentiment_data['lhb_buy_amount'] = "N/A"
                sentiment_data['lhb_sell_amount'] = "N/A"
                sentiment_data['lhb_net_amount'] = "N/A"
            
            # Format the sentiment analysis
            result = f"## Insider Sentiment Analysis for {ticker} ({curr_date})\n\n"
            result += f"**Data Source**: AKShare - A股市场数据\n\n"
            result += f"**Insider Transactions:** {sentiment_data.get('insider_transactions', 'N/A')}\n"
            result += f"**Main Fund Net Flow:** {sentiment_data.get('main_fund_flow', 'N/A')}\n"
            result += f"**Main Fund Flow Percentage:** {sentiment_data.get('main_fund_flow_pct', 'N/A')}\n"
            result += f"**Dragon-Tiger List Buy Amount:** {sentiment_data.get('lhb_buy_amount', 'N/A')}\n"
            result += f"**Dragon-Tiger List Sell Amount:** {sentiment_data.get('lhb_sell_amount', 'N/A')}\n"
            result += f"**Dragon-Tiger List Net Amount:** {sentiment_data.get('lhb_net_amount', 'N/A')}\n"
            
            return result
        
        elif market == 'US_STOCK':
            return (
                f"Insider sentiment analysis not supported for US stocks in AKShare.\n\n"
                f"**Recommendation**: Use Alpha Vantage's NEWS_SENTIMENT API:\n"
                f"- Provides sentiment scores from news articles\n"
                f"- Includes insider transaction sentiment\n"
                f"- Real-time sentiment analysis\n\n"
                f"Alternative: Use social media sentiment tools or financial news APIs."
            )
        
        elif market == 'HK_STOCK':
            return (
                f"Insider sentiment analysis not supported for HK stocks in AKShare.\n\n"
                f"**Recommendation**: Use alternative data sources:\n"
                f"- Financial news sentiment APIs\n"
                f"- Social media sentiment analysis\n"
                f"- Market microstructure indicators\n\n"
                f"Note: HK market sentiment data is less readily available than US markets."
            )
        
        else:
            return f"Insider sentiment analysis not supported for market: {MARKET_PATTERNS.get(market, {}).get('description', 'Unknown')}"
            
    except Exception as e:
        return f"Error analyzing insider sentiment for {ticker}: {str(e)}"
