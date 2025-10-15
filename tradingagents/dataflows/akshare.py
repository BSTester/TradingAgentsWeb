"""
AKShare数据源主入口文件
提供所有AKShare功能的统一导入接口
"""

# 股票数据模块
from .akshare_stock import (
    get_stock_data as get_akshare_stock_data,
    get_realtime_data as get_akshare_realtime_data,
    get_stock_info as get_akshare_company_info
)

# 财务数据模块  
from .akshare_fundamentals import (
    get_balance_sheet as get_akshare_balance_sheet,
    get_income_statement as get_akshare_income_statement,
    get_cashflow as get_akshare_cashflow,
    get_fundamentals as get_akshare_fundamentals
)

# 新闻数据模块
from .akshare_news import (
    get_stock_news as get_akshare_stock_news,
    get_global_news as get_akshare_global_news,
    get_market_sentiment as get_akshare_market_sentiment,
    get_aggregated_news as get_akshare_aggregated_news,
    get_enhanced_market_sentiment as get_akshare_enhanced_market_sentiment
)

# 技术指标模块
from .akshare_indicators import (
    get_akshare_indicators
)

# 财务数据别名函数，保持与原有接口的兼容性
def get_akshare_financial_data(symbol: str, report_type: str = "balance_sheet"):
    """
    获取财务数据的兼容性包装函数
    
    Args:
        symbol: 股票代码
        report_type: 报告类型 ('balance_sheet', 'income_statement', 'cashflow')
        
    Returns:
        str: 财务数据CSV字符串
    """
    if report_type == 'balance_sheet':
        return get_akshare_balance_sheet(symbol)
    elif report_type == 'income_statement':
        return get_akshare_income_statement(symbol)
    elif report_type == 'cashflow':
        return get_akshare_cashflow(symbol)
    else:
        return f"Error: Unsupported report type '{report_type}'"


# 导出所有可用的函数
__all__ = [
    # 股票数据
    'get_akshare_stock_data',
    'get_akshare_realtime_data', 
    'get_akshare_company_info',
    
    # 财务数据
    'get_akshare_balance_sheet',
    'get_akshare_income_statement',
    'get_akshare_cashflow',
    'get_akshare_fundamentals',
    'get_akshare_financial_data',  # 兼容性函数
    
    # 新闻数据
    'get_akshare_stock_news',
    'get_akshare_global_news',
    'get_akshare_market_sentiment',
    'get_akshare_aggregated_news',
    'get_akshare_enhanced_market_sentiment',
    
    # 技术指标
    'get_akshare_indicators'
]