"""Registry for internal data collection skills."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from web.backend.services.skills.base import RoutedSkillProvider
from web.backend.utils.market_detector import detect_market, normalize_ticker_with_suffix


def _schema(required: list[str], properties: Dict[str, Any]) -> Dict[str, Any]:
    return {"type": "object", "required": required, "properties": properties}


def _start_date(curr_date: str, look_back_days: int) -> str:
    current = datetime.strptime(curr_date, "%Y-%m-%d").date()
    return (current - timedelta(days=int(look_back_days))).isoformat()


def _route_to_vendor(method: str, *args: Any) -> Any:
    from tradingagents.dataflows.interface import route_to_vendor

    return route_to_vendor(method, *args)


class SkillRegistry:
    def __init__(self) -> None:
        self._skills = self._build_skills()

    def _build_skills(self) -> Dict[str, RoutedSkillProvider]:
        common_symbol = {
            "symbol": {"type": "string", "description": "Ticker symbol, e.g. AAPL, 0700.HK, 600519.SH"},
            "curr_date": {"type": "string", "format": "date"},
        }
        return {
            "market-data": RoutedSkillProvider(
                name="market-data",
                display_name="K线/行情",
                description="获取 OHLCV、实时报价、历史行情数据",
                input_schema=_schema(["symbol", "curr_date"], common_symbol),
                providers=["yfinance", "akshare", "baostock", "alpha_vantage"],
                primary_source="yfinance",
                fallback_source="akshare",
                markets=["US", "HK", "CN"],
                actions={
                    "historical": lambda symbol, curr_date, look_back_days=30, **_: _route_to_vendor(
                        "get_stock_data", symbol, _start_date(curr_date, look_back_days), curr_date
                    ),
                    "quote": lambda symbol, **_: _route_to_vendor("get_realtime_quote", symbol),
                },
            ),
            "technical-indicators": RoutedSkillProvider(
                name="technical-indicators",
                display_name="技术指标",
                description="计算 MACD/RSI/布林带等指标",
                input_schema=_schema(["symbol", "indicator", "curr_date"], {
                    **common_symbol,
                    "indicator": {"type": "string"},
                    "look_back_days": {"type": "integer", "default": 30},
                }),
                providers=["yfinance", "akshare", "baostock", "alpha_vantage"],
                primary_source="yfinance",
                fallback_source="alpha_vantage",
                markets=["US", "HK", "CN"],
                actions={
                    "indicator": lambda symbol, indicator, curr_date, look_back_days=30, **_: _route_to_vendor(
                        "get_indicators", symbol, indicator, curr_date, look_back_days
                    ),
                },
            ),
            "fundamentals": RoutedSkillProvider(
                name="fundamentals",
                display_name="基本面/投资信息",
                description="基本面、资产负债表、现金流、利润表",
                input_schema=_schema(["ticker"], {"ticker": {"type": "string"}}),
                providers=["alpha_vantage", "akshare", "baostock", "yfinance"],
                primary_source="alpha_vantage",
                fallback_source="akshare",
                markets=["US", "HK", "CN"],
                actions={
                    "summary": lambda ticker, curr_date=None, **_: _route_to_vendor("get_fundamentals", ticker, curr_date or datetime.now(timezone.utc).date().isoformat()),
                    "balance_sheet": lambda ticker, curr_date=None, freq="quarterly", **_: _route_to_vendor("get_balance_sheet", ticker, freq, curr_date),
                    "cashflow": lambda ticker, curr_date=None, freq="quarterly", **_: _route_to_vendor("get_cashflow", ticker, freq, curr_date),
                    "income_statement": lambda ticker, curr_date=None, freq="quarterly", **_: _route_to_vendor("get_income_statement", ticker, freq, curr_date),
                },
            ),
            "news": RoutedSkillProvider(
                name="news",
                display_name="新闻/宏观",
                description="公司新闻、全球宏观新闻",
                input_schema=_schema(["ticker", "start_date", "end_date"], {
                    "ticker": {"type": "string"},
                    "start_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                }),
                providers=["google", "akshare", "baostock", "alpha_vantage"],
                primary_source="google",
                fallback_source="akshare",
                markets=["US", "HK", "CN"],
                actions={
                    "company": lambda ticker, start_date, end_date, **_: _route_to_vendor(
                        "get_news", ticker, start_date, end_date
                    ),
                    "global": lambda curr_date=None, look_back_days=7, limit=5, **_: _route_to_vendor("get_global_news", curr_date or datetime.now(timezone.utc).date().isoformat(), look_back_days, limit),
                },
            ),
            "social-sentiment": RoutedSkillProvider(
                name="social-sentiment",
                display_name="社交舆情",
                description="社交帖子、情绪分析，并要求结论锚定数据快照",
                input_schema=_schema(["ticker", "start_date", "end_date"], {
                    "ticker": {"type": "string"},
                    "start_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                }),
                providers=["akshare", "baostock", "alpha_vantage", "google"],
                primary_source="akshare",
                fallback_source="alpha_vantage",
                markets=["US", "HK", "CN"],
                actions={
                    "sentiment": lambda ticker, start_date, end_date, **_: _route_to_vendor(
                        "get_news", ticker, start_date, end_date
                    ),
                },
            ),
            "market-detection": RoutedSkillProvider(
                name="market-detection",
                display_name="市场识别",
                description="标的→市场识别、后缀规范化",
                input_schema=_schema(["symbol"], {"symbol": {"type": "string"}}),
                providers=["internal"],
                primary_source="internal",
                fallback_source=None,
                markets=["US", "HK", "CN"],
                actions={
                    "detect": lambda symbol, **_: {
                        "symbol": symbol,
                        "normalized_symbol": normalize_ticker_with_suffix(symbol),
                        "market": detect_market(symbol),
                    },
                },
            ),
        }

    def list_health(self) -> Dict[str, Any]:
        return {
            "skills": [skill.health() for skill in self._skills.values()],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    def get(self, name: str) -> RoutedSkillProvider:
        if name not in self._skills:
            raise KeyError(f"Unknown skill: {name}")
        return self._skills[name]

    def execute(self, name: str, action: str, **kwargs: Any) -> Any:
        return self.get(name).execute(action, **kwargs)


_REGISTRY = SkillRegistry()


def get_skill_registry() -> SkillRegistry:
    return _REGISTRY
