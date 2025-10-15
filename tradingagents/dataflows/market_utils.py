"""
Market utilities for identifying stock markets and formatting symbols.
"""
import re
from typing import Tuple, Optional


class MarketIdentifier:
    """Utility class for identifying stock markets based on symbol format."""
    
    # A股市场代码模式
    A_STOCK_PATTERNS = [
        r'^(000|002|003)\d{3}$',  # 深交所主板/中小板/创业板
        r'^30\d{4}$',             # 创业板
        r'^60\d{4}$',             # 上交所主板
        r'^68\d{4}$',             # 科创板
        r'^8\d{5}$',              # 北交所
        r'^4\d{5}$',              # 三板
    ]
    
    # 港股代码模式
    HK_STOCK_PATTERNS = [
        r'^\d{4,5}\.HK$',         # 标准港股格式 (0700.HK)
        r'^\d{4,5}$',             # 纯数字港股代码 (0700)
    ]
    
    # 美股代码模式 (通常是字母组合)
    US_STOCK_PATTERNS = [
        r'^[A-Z]{1,5}$',          # 1-5个字母的美股代码
        r'^[A-Z]+\.[A-Z]+$',      # 带交易所后缀的美股代码
        r'^\d+\.[A-Z]+$',         # AKShare特殊格式: 数字.字母 (如 106.TTE)
    ]
    
    @classmethod
    def identify_market(cls, symbol: str) -> str:
        """
        识别股票代码所属市场
        
        Args:
            symbol: 股票代码
            
        Returns:
            str: 'A_STOCK', 'HK_STOCK', 'US_STOCK', 或 'UNKNOWN'
        """
        symbol = symbol.upper().strip()
        
        # 检查A股
        for pattern in cls.A_STOCK_PATTERNS:
            if re.match(pattern, symbol):
                return 'A_STOCK'
        
        # 检查港股
        for pattern in cls.HK_STOCK_PATTERNS:
            if re.match(pattern, symbol):
                return 'HK_STOCK'
        
        # 检查美股
        for pattern in cls.US_STOCK_PATTERNS:
            if re.match(pattern, symbol):
                return 'US_STOCK'
        
        return 'UNKNOWN'
    
    @classmethod
    def format_symbol_for_vendor(cls, symbol: str, vendor: str, market: str = None) -> str:
        """
        为特定数据供应商格式化股票代码
        
        Args:
            symbol: 原始股票代码
            vendor: 数据供应商 ('akshare', 'baostock', 'yfinance', 'alpha_vantage')
            market: 市场类型，如果为None则自动识别
            
        Returns:
            str: 格式化后的股票代码
        """
        if market is None:
            market = cls.identify_market(symbol)
        
        symbol = symbol.upper().strip()
        
        if vendor == 'akshare':
            if market == 'A_STOCK':
                # AKShare A股格式: 纯数字格式（不需要sz/sh前缀）
                # 去除可能存在的前缀
                if symbol.startswith(('sz', 'sh')):
                    return symbol[2:]  # 去除sz/sh前缀
                return symbol  # 纯数字保持原样
            elif market == 'HK_STOCK':
                # AKShare 港股格式: 去掉.HK后缀，保持数字
                return symbol.replace('.HK', '').zfill(5)
            elif market == 'US_STOCK':
                # AKShare 美股格式: stock_us_daily 接口支持标准美股代码
                # 直接使用原始符号，无需转换
                return symbol
                
        elif vendor == 'baostock':
            if market == 'A_STOCK':
                # BaoStock A股格式: sz.000001, sh.600000
                if symbol.startswith(('000', '002', '003', '30')):
                    return f'sz.{symbol}'
                elif symbol.startswith(('60', '68')):
                    return f'sh.{symbol}'
                else:
                    return symbol
            # BaoStock 主要支持A股
            
        elif vendor in ['yfinance', 'alpha_vantage']:
            if market == 'A_STOCK':
                # Yahoo Finance A股格式: 000001.SZ, 600000.SS
                if symbol.startswith(('000', '002', '003', '30')):
                    return f'{symbol}.SZ'
                elif symbol.startswith(('60', '68')):
                    return f'{symbol}.SS'
                else:
                    return symbol
            elif market == 'HK_STOCK':
                # Yahoo Finance 港股格式: 0700.HK
                if not symbol.endswith('.HK'):
                    return f'{symbol.zfill(4)}.HK'
                return symbol
            elif market == 'US_STOCK':
                # 美股保持原样
                return symbol
        
        return symbol
    
    @classmethod
    def get_supported_markets(cls, vendor: str) -> list:
        """
        获取数据供应商支持的市场
        
        Args:
            vendor: 数据供应商名称
            
        Returns:
            list: 支持的市场列表
        """
        support_map = {
            'akshare': ['A_STOCK', 'HK_STOCK', 'US_STOCK'],
            'baostock': ['A_STOCK'],
            'yfinance': ['A_STOCK', 'HK_STOCK', 'US_STOCK'],
            'alpha_vantage': ['US_STOCK'],  # 主要支持美股
        }
        return support_map.get(vendor, [])
    
    @classmethod
    def is_market_supported(cls, symbol: str, vendor: str) -> bool:
        """
        检查数据供应商是否支持该股票市场
        
        Args:
            symbol: 股票代码
            vendor: 数据供应商
            
        Returns:
            bool: 是否支持
        """
        market = cls.identify_market(symbol)
        supported_markets = cls.get_supported_markets(vendor)
        return market in supported_markets


def get_market_info(symbol: str) -> dict:
    """
    获取股票的市场信息
    
    Args:
        symbol: 股票代码
        
    Returns:
        dict: 包含市场信息的字典
    """
    market = MarketIdentifier.identify_market(symbol)
    
    market_info = {
        'symbol': symbol,
        'market': market,
        'market_name': {
            'A_STOCK': '中国A股',
            'HK_STOCK': '香港股市',
            'US_STOCK': '美国股市',
            'UNKNOWN': '未知市场'
        }.get(market, '未知市场'),
        'timezone': {
            'A_STOCK': 'Asia/Shanghai',
            'HK_STOCK': 'Asia/Hong_Kong', 
            'US_STOCK': 'America/New_York',
            'UNKNOWN': 'UTC'
        }.get(market, 'UTC'),
        'currency': {
            'A_STOCK': 'CNY',
            'HK_STOCK': 'HKD',
            'US_STOCK': 'USD',
            'UNKNOWN': 'USD'
        }.get(market, 'USD')
    }
    
    return market_info