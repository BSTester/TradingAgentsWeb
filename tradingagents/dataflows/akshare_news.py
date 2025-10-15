"""
AKShare新闻数据获取模块
提供股票新闻、全球财经新闻和市场情绪数据的获取功能
"""
from typing import Annotated, Tuple
import pandas as pd
from datetime import datetime
from .akshare_common import (
    check_akshare_availability, validate_market_support, format_symbol_for_market,
    handle_akshare_exception, log_operation, ak
)


def _get_enhanced_fallback_news(limit: int = 20) -> Tuple[pd.DataFrame, str]:
    """
    获取增强的兜底新闻数据，集成所有可用新闻源
    
    Args:
        limit: 限制返回的新闻条数
        
    Returns:
        Tuple[pd.DataFrame, str]: (新闻数据, 新闻源名称)
    """
    # 扩展的新闻源列表，按优先级排序
    news_sources = [
        # 第一梯队：实时财经资讯
        ("财联社电报", lambda: ak.stock_info_global_cls()),
        ("同花顺全球资讯", lambda: ak.stock_info_global_ths()),
        ("新浪全球资讯", lambda: ak.stock_info_global_sina()),
        ("富途全球资讯", lambda: ak.stock_info_global_futu()),
        
        # 第二梯队：权威新闻源
        ("央视新闻", lambda: ak.news_cctv()),
        ("百度经济新闻", lambda: ak.news_economic_baidu()),
        
        # 第三梯队：综合资讯平台
        ("东方财富全球资讯", lambda: ak.stock_info_global_em()),
        ("创新层股票新闻", lambda: ak.stock_news_main_cx()),
        
        # 第四梯队：期货和其他财经新闻
        ("上海金属期货新闻", lambda: ak.futures_news_shmet()),
    ]
    
    for source_name, source_func in news_sources:
        try:
            log_operation(f"get_enhanced_fallback_news from {source_name}", status="ATTEMPT")
            data = source_func()
            if not data.empty:
                # 确保数据格式正确，添加基本字段检查
                if len(data.columns) > 0:  # 至少有一些列数据
                    if len(data) > limit:
                        data = data.head(limit)
                    log_operation(f"get_enhanced_fallback_news from {source_name}", status="SUCCESS")
                    return data, source_name
        except Exception as e:
            log_operation(f"get_enhanced_fallback_news from {source_name}", status="FAILED")
            print(f"Warning: {source_name} news source failed: {e}")
            continue
    
    # 如果所有新闻源都失败，返回空数据
    return pd.DataFrame(), "无可用新闻源"


def _get_fallback_news(limit: int = 20) -> Tuple[pd.DataFrame, str]:
    """
    向后兼容的兜底新闻函数，调用增强版本
    """
    return _get_enhanced_fallback_news(limit)


def _get_stock_specific_news(symbol: str, market: str, formatted_symbol: str, limit: int = 20) -> Tuple[pd.DataFrame, str]:
    """
    尝试获取个股特定新闻
    
    Args:
        symbol: 原始股票代码
        market: 市场类型
        formatted_symbol: 格式化后的股票代码
        limit: 限制返回的新闻条数
        
    Returns:
        Tuple[pd.DataFrame, str]: (新闻数据, 新闻源名称)
    """
    # 准备股票代码，stock_news_em接口可以处理不同市场的股票
    if market == 'A_STOCK':
        # A股使用纯数字代码
        clean_symbol = formatted_symbol.replace('sz', '').replace('sh', '')
    elif market == 'HK_STOCK':
        # 港股使用纯数字代码，去掉.HK后缀
        clean_symbol = formatted_symbol.replace('.HK', '').zfill(5)
    elif market == 'US_STOCK':
        # 美股使用原始代码
        clean_symbol = symbol.upper()
    else:
        clean_symbol = symbol
    
    # 尝试使用stock_news_em获取个股新闻
    try:
        log_operation(f"get_stock_specific_news for {symbol} ({market})", status="ATTEMPT")
        print(f"Info: Trying to get news for {symbol} ({market}) using symbol: {clean_symbol}")
        
        # 使用更稳定的参数调用方式
        data = ak.stock_news_em(symbol=clean_symbol)
        
        if not data.empty:
            # 检查数据质量，确保有有效列
            if len(data.columns) > 0:
                if len(data) > limit:
                    data = data.head(limit)
                log_operation(f"get_stock_specific_news for {symbol}", status="SUCCESS")
                return data, f"东方财富个股新闻({market})"
            else:
                print(f"Info: Empty columns in news data for {symbol}, using fallback")
        else:
            print(f"Info: No specific news found for {symbol}, using fallback")
    except Exception as e:
        print(f"Warning: stock_news_em failed for {symbol} ({clean_symbol}): {e}")
        # 可能是网络问题或API参数问题，尝试另一种调用方式
        try:
            # 对于A股，尝试使用带前缀的格式
            if market == 'A_STOCK':
                prefixed_symbol = formatted_symbol  # sz000001 或 sh600000
                data = ak.stock_news_em(symbol=prefixed_symbol)
                if not data.empty:
                    if len(data) > limit:
                        data = data.head(limit)
                    log_operation(f"get_stock_specific_news for {symbol} (alternative)", status="SUCCESS")
                    return data, f"东方财富个股新闻({market})"
        except Exception as e2:
            print(f"Warning: Alternative stock_news_em call also failed: {e2}")
    
    # 如果个股新闻获取失败，使用兜底新闻源
    print(f"Info: Using fallback news for {symbol} ({market})")
    log_operation(f"get_stock_specific_news for {symbol}", status="FAILED")
    return _get_fallback_news(limit)


def get_stock_news(query, start_date, end_date) -> str:
    """
    获取股票相关新闻
    
    Args:
        query: 查询关键词或股票代码
        start_date: 开始日期
        end_date: 结束日期
        
    Returns:
        str: CSV格式的新闻数据
    """
    try:
        check_akshare_availability()
        
        # 使用固定的limit值
        limit = 20
        
        market_info = None
        if query:
            # 验证市场支持并获取市场信息
            market, market_info = validate_market_support(query, "stock news retrieval")
            formatted_symbol = format_symbol_for_market(query, market)
            
            # 使用统一的个股新闻获取逻辑
            data, news_source = _get_stock_specific_news(query, market, formatted_symbol, limit)
        else:
            # 获取全球财经新闻
            data, news_source = _get_fallback_news(limit)
        
        if data.empty:
            return f"No news found for query '{query}'" if query else "No general news found"
        
        # 限制新闻数量
        if len(data) > limit:
            data = data.head(limit)
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = []
        if query and market_info:
            header_lines.extend([
                f"# Stock news for {query} ({market_info['market_name']})",
                f"# Market: {market_info['market_name']} ({market_info['currency']})",
                f"# News source: {news_source}",
                f"# Date range: {start_date} to {end_date}"
            ])
        else:
            header_lines.extend([
                f"# General financial news",
                f"# News source: {news_source}",
                f"# Date range: {start_date} to {end_date}"
            ])
        
        header_lines.extend([
            f"# Total news items: {len(data)}",
            f"# Data provider: AKShare",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ])
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_stock_news", query, market if query else None, "SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_stock_news", query, 
                     market if 'market' in locals() else None, "FAILED")
        return handle_akshare_exception(e, "retrieving stock news", query)


def get_global_news(curr_date, look_back_days=7, limit=5) -> str:
    """
    获取全球财经新闻
    
    Args:
        curr_date: 当前日期
        look_back_days: 回溯天数
        limit: 限制返回的新闻条数
        
    Returns:
        str: CSV格式的全球新闻数据
    """
    try:
        check_akshare_availability()
        
        log_operation("get_global_news", status="ATTEMPT")
        
        # 获取全球财经新闻，统一使用兜底逻辑
        data, news_source = _get_fallback_news(limit)
        
        if data.empty:
            log_operation("get_global_news", status="FAILED")
            return f"No global news found from any available source"
        
        # 转换为CSV字符串
        csv_string = data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Global financial news",
            f"# Date range: {look_back_days} days before {curr_date} to {curr_date}",
            f"# News source: {news_source}",
            f"# Total news items: {len(data)}",
            f"# Data provider: AKShare",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_global_news", status="SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_global_news", status="FAILED")
        return handle_akshare_exception(e, "retrieving global news")


def get_aggregated_news(
    category: Annotated[str, "news category"] = "finance",
    limit: Annotated[int, "number of news items to retrieve"] = 20,
    sources: Annotated[int, "number of sources to aggregate from"] = 3
) -> str:
    """
    获取聚合多源新闻数据
    
    Args:
        category: 新闻类别
        limit: 每个源限制返回的新闻条数
        sources: 聚合的源数量
        
    Returns:
        str: CSV格式的聚合新闻数据
    """
    try:
        check_akshare_availability()
        
        log_operation("get_aggregated_news", status="ATTEMPT")
        
        # 定义所有可用的新闻源
        all_news_sources = [
            ("财联社电报", lambda: ak.stock_info_global_cls()),
            ("同花顺全球资讯", lambda: ak.stock_info_global_ths()),
            ("新浪全球资讯", lambda: ak.stock_info_global_sina()),
            ("富途全球资讯", lambda: ak.stock_info_global_futu()),
            ("央视新闻", lambda: ak.news_cctv()),
            ("百度经济新闻", lambda: ak.news_economic_baidu()),
            ("东方财富全球资讯", lambda: ak.stock_info_global_em()),
            ("创新层股票新闻", lambda: ak.stock_news_main_cx()),
        ]
        
        aggregated_data = []
        successful_sources = []
        
        # 从多个源获取新闻
        for i, (source_name, source_func) in enumerate(all_news_sources[:sources]):
            try:
                log_operation(f"get_aggregated_news from {source_name}", status="ATTEMPT")
                data = source_func()
                if not data.empty and len(data.columns) > 0:
                    if len(data) > limit:
                        data = data.head(limit)
                    
                    # 添加源标识
                    data = data.copy()
                    data['news_source'] = source_name
                    aggregated_data.append(data)
                    successful_sources.append(source_name)
                    
                    log_operation(f"get_aggregated_news from {source_name}", status="SUCCESS")
                    print(f"Successfully collected {len(data)} news items from {source_name}")
                else:
                    print(f"No data from {source_name}")
            except Exception as e:
                log_operation(f"get_aggregated_news from {source_name}", status="FAILED")
                print(f"Warning: Failed to get news from {source_name}: {e}")
                continue
        
        if not aggregated_data:
            log_operation("get_aggregated_news", status="FAILED")
            return f"No aggregated {category} news found from any source"
        
        # 合并所有数据
        try:
            combined_data = pd.concat(aggregated_data, ignore_index=True, sort=False)
        except Exception as e:
            # 如果合并失败，使用第一个有效数据源
            print(f"Warning: Failed to concat data, using first source: {e}")
            combined_data = aggregated_data[0]
        
        # 转换为CSV字符串
        csv_string = combined_data.to_csv(index=False)
        
        # 构建头部信息
        header_lines = [
            f"# Aggregated {category} news from multiple sources",
            f"# Category: {category}",
            f"# News sources: {', '.join(successful_sources)}",
            f"# Total news items: {len(combined_data)}",
            f"# Sources used: {len(successful_sources)}",
            f"# Data provider: AKShare (Multi-source)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_aggregated_news", status="SUCCESS")
        return header + csv_string
        
    except Exception as e:
        log_operation("get_aggregated_news", status="FAILED")
        return handle_akshare_exception(e, f"retrieving aggregated news for category {category}")



def get_market_sentiment() -> str:
    """
    获取市场情绪数据
    
    Returns:
        str: CSV格式的市场情绪数据
    """
    try:
        check_akshare_availability()
        
        log_operation("get_market_sentiment", status="ATTEMPT")
        
        # 获取市场情绪相关数据
        sentiment_data = {}
        
        # 尝试获取不同的市场情绪指标
        try:
            # A股市场概况
            a_stock_spot = ak.stock_zh_a_spot_em()
            if not a_stock_spot.empty:
                sentiment_data['a_stock_summary'] = a_stock_spot.head(10)
                print("Successfully retrieved A-stock market summary")
        except Exception as e:
            print(f"Failed to retrieve A-stock summary: {e}")
        
        try:
            # 资金流向数据
            money_flow = ak.stock_market_fund_flow()
            if not money_flow.empty:
                sentiment_data['money_flow'] = money_flow
                print("Successfully retrieved money flow data")
        except Exception as e:
            print(f"Failed to retrieve money flow data: {e}")
        
        if not sentiment_data:
            log_operation("get_market_sentiment", status="FAILED")
            return "Error: Unable to retrieve market sentiment data from AKShare"
        
        # 合并所有情绪数据
        combined_csv = ""
        for data_type, data in sentiment_data.items():
            combined_csv += f"\n## {data_type.upper()} ##\n"
            combined_csv += data.to_csv(index=False)
            combined_csv += "\n"
        
        # 构建头部信息
        header_lines = [
            f"# Market sentiment data",
            f"# Data types: {', '.join(sentiment_data.keys())}",
            f"# Data source: AKShare",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_market_sentiment", status="SUCCESS")
        return header + combined_csv
        
    except Exception as e:
        log_operation("get_market_sentiment", status="FAILED")
        return handle_akshare_exception(e, "retrieving market sentiment")


def get_enhanced_market_sentiment() -> str:
    """
    获取增强的市场情绪数据，集成多种数据源
    
    Returns:
        str: CSV格式的市场情绪数据
    """
    try:
        check_akshare_availability()
        
        log_operation("get_enhanced_market_sentiment", status="ATTEMPT")
        
        # 获取市场情绪相关数据
        sentiment_data = {}
        
        # 尝试获取不同的市场情绪指标
        sentiment_sources = [
            ("A股市场概况", "a_stock_summary", lambda: ak.stock_zh_a_spot_em().head(20)),
            ("资金流向数据", "money_flow", lambda: ak.stock_market_fund_flow()),
            ("新闻情绪指数", "news_sentiment", lambda: ak.index_news_sentiment_scope()),
            ("百度交易提醒-停牌", "trade_suspend", lambda: ak.news_trade_notify_suspend_baidu()),
            ("百度交易提醒-分红", "trade_dividend", lambda: ak.news_trade_notify_dividend_baidu()),
            ("百度报告时间", "report_time", lambda: ak.news_report_time_baidu()),
        ]
        
        for desc, key, source_func in sentiment_sources:
            try:
                print(f"Attempting to retrieve {desc}...")
                data = source_func()
                if not data.empty:
                    sentiment_data[key] = data
                    print(f"Successfully retrieved {desc}: {len(data)} records")
                else:
                    print(f"No data available for {desc}")
            except Exception as e:
                print(f"Failed to retrieve {desc}: {e}")
        
        if not sentiment_data:
            log_operation("get_enhanced_market_sentiment", status="FAILED")
            return "Error: Unable to retrieve any market sentiment data from AKShare"
        
        # 合并所有情绪数据
        combined_csv = ""
        for data_type, data in sentiment_data.items():
            combined_csv += f"\n## {data_type.upper()} ##\n"
            combined_csv += data.to_csv(index=False)
            combined_csv += "\n"
        
        # 构建头部信息
        header_lines = [
            f"# Enhanced market sentiment data",
            f"# Data types: {', '.join(sentiment_data.keys())}",
            f"# Total data sources: {len(sentiment_data)}",
            f"# Data source: AKShare (Multi-source sentiment analysis)",
            f"# Data retrieved on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ]
        
        header = '\n'.join(header_lines) + '\n\n'
        
        log_operation("get_enhanced_market_sentiment", status="SUCCESS")
        return header + combined_csv
        
    except Exception as e:
        log_operation("get_enhanced_market_sentiment", status="FAILED")
        return handle_akshare_exception(e, "retrieving enhanced market sentiment")