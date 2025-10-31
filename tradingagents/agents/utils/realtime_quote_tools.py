from langchain_core.tools import tool
from typing import Annotated
from tradingagents.dataflows.interface import route_to_vendor


@tool
def get_realtime_quote(
    symbol: Annotated[str, "ticker symbol of the company"],
) -> str:
    """
    Retrieve real-time stock quote data.
    
    Supports A-shares, US stocks, and Hong Kong stocks through a unified interface.
    Returns current market data including price, volume, and key metrics.
    Uses the configured realtime_quote vendor (default: akshare/XueQiu).
    
    Args:
        symbol (str): Stock symbol (e.g., "600519" for A-share, "AAPL" for US stock, "00700" for HK stock)
    
    Returns:
        str: Formatted string containing real-time quote data with metadata header including:
            - Current price, open, high, low, previous close
            - Volume and amount
            - Change and change percent
            - P/E ratio, P/B ratio, market cap
            - Turnover rate and other key metrics
    
    Note:
        For akshare vendor: Requires XUEQIU_TOKEN environment variable to be set.
        See docs/XUEQIU_TOKEN_SETUP.md for setup instructions.
    """
    return route_to_vendor("get_realtime_quote", symbol)
