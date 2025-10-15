"""
BaoStock数据源主入口文件
提供所有BaoStock功能的统一导入接口
"""

# 股票数据模块
from .baostock_stock import (
    get_stock_data as get_baostock_stock_data,
    get_stock_info as get_baostock_company_info,
    get_realtime_data as get_baostock_realtime_data,
    get_dividend_data as get_baostock_dividend_data
)

# 财务数据模块  
from .baostock_fundamentals import (
    get_balance_sheet as get_baostock_balance_sheet,
    get_income_statement as get_baostock_income_statement,
    get_cashflow as get_baostock_cashflow,
    get_fundamentals as get_baostock_fundamentals,
    get_financial_data as get_baostock_financial_data
)

# 导出所有可用的函数
__all__ = [
    # 股票数据
    'get_baostock_stock_data',
    'get_baostock_company_info',
    'get_baostock_realtime_data',
    'get_baostock_dividend_data',
    
    # 财务数据
    'get_baostock_balance_sheet',
    'get_baostock_income_statement',
    'get_baostock_cashflow',
    'get_baostock_fundamentals',
    'get_baostock_financial_data',
]