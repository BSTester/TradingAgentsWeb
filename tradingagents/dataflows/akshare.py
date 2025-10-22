"""
AKShare数据源主入口文件
提供所有AKShare功能的统一导入接口
"""

# 股票数据模块
from .akshare_stock import (
    get_stock as get_akshare_stock
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
    get_news as get_akshare_news,
    get_insider_transactions as get_akshare_insider_transactions,
    get_global_news as get_akshare_global_news
)

# 技术指标模块
from .akshare_indicators import (
    get_indicator as get_akshare_indicator
)


# 导出所有可用的函数
__all__ = [
    # 股票数据
    'get_akshare_stock',
    
    # 财务数据
    'get_akshare_balance_sheet',
    'get_akshare_income_statement',
    'get_akshare_cashflow',
    'get_akshare_fundamentals',
    
    # 新闻数据
    'get_akshare_news',
    'get_akshare_insider_transactions',
    'get_akshare_global_news',
    
    # 技术指标
    'get_akshare_indicator'
]
