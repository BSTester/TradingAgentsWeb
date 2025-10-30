"""
BaoStock数据源主入口文件
提供所有BaoStock功能的统一导入接口
"""

# 股票数据模块
from .baostock_stock import (
    get_stock as get_baostock_stock
)

# 财务数据模块  
from .baostock_fundamentals import (
    get_balance_sheet as get_baostock_balance_sheet,
    get_income_statement as get_baostock_income_statement,
    get_cashflow as get_baostock_cashflow,
    get_fundamentals as get_baostock_fundamentals
)

# 新闻数据模块
from .baostock_news import (
    get_news as get_baostock_news,
    get_insider_transactions as get_baostock_insider_transactions
)

# 技术指标模块
from .baostock_indicators import (
    get_indicator as get_baostock_indicator
)


# 导出所有可用的函数
__all__ = [
    # 股票数据
    'get_baostock_stock',
    
    # 财务数据
    'get_baostock_balance_sheet',
    'get_baostock_income_statement',
    'get_baostock_cashflow',
    'get_baostock_fundamentals',
    
    # 新闻数据
    'get_baostock_news',
    'get_baostock_insider_transactions',
    
    # 技术指标
    'get_baostock_indicator'
]
