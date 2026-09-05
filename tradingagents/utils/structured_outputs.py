"""Structured report helpers for the conversational report contract."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List


SECTION_KEYS = [
    "market_technical",
    "fundamentals",
    "sentiment",
    "news_macro",
    "risk",
]


def _clip(text: object, limit: int = 1600) -> str:
    value = str(text or "").strip()
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value[:limit]


def recommendation_from_text(text: str) -> str:
    upper = (text or "").upper()
    if "STRONG BUY" in upper or "强烈买入" in upper:
        return "strong_buy"
    if "STRONG SELL" in upper or "强烈卖出" in upper:
        return "strong_sell"
    if "BUY" in upper or "买入" in upper:
        return "buy"
    if "SELL" in upper or "卖出" in upper:
        return "sell"
    return "hold"


def rating_from_text(text: str) -> int:
    rec = recommendation_from_text(text)
    return {
        "strong_sell": 1,
        "sell": 2,
        "hold": 3,
        "buy": 4,
        "strong_buy": 5,
    }[rec]


def section(title: str, source_text: str, default_rating: int | None = None) -> Dict[str, Any]:
    rating = default_rating or rating_from_text(source_text)
    lines = [line.strip("-* \t") for line in str(source_text or "").splitlines() if line.strip()]
    key_points = lines[:5] if lines else ["暂无足够数据，需结合后续技能结果复核。"]
    return {
        "title": title,
        "rating": max(1, min(5, int(rating))),
        "summary": _clip("；".join(key_points[:2]), 400),
        "details": _clip(source_text),
        "key_points": key_points,
    }


def evidence_snapshot(ticker: str, as_of: str, report: str, sources: Iterable[str]) -> List[Dict[str, Any]]:
    """Build a compact grounded evidence snapshot from available report text."""
    excerpt = _clip(report, 500)
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "source": source,
            "title": f"{ticker} {source} snapshot",
            "url": None,
            "excerpt": excerpt,
            "confidence": 0.7 if excerpt else 0.2,
            "as_of": as_of,
            "captured_at": now,
        }
        for source in sources
    ]


def _extract_price_range(text: str) -> Optional[List[float]]:
    """Extract a buy/sell price range from trader/risk text (X–Y / X~Y / PRICE RANGE: X-Y)."""
    import re
    if not text:
        return None
    num = r"\d[\d,]*\.?\d*"
    # 只在明确「价格区间 / 参考区间 / PRICE RANGE」或「X–Y 单位」语境下提取
    pats = [
        re.compile(r"(?:价格区间|参考区间|入场区间|交易区间|价格带|建议区间|PRICE\s*RANGE)\s*[:：]?\s*" + num + r"\s*[~\-–—]\s*" + num),
        re.compile(num + r"\s*[~\-–—]\s*" + num + r"\s*(?:元|股|USD|HKD|CNY|美元|港币|人民币|/股|per share)"),
    ]
    for pat in pats:
        for m in pat.finditer(text):
            if "%" in m.group(0):
                continue
            nums = re.findall(num, m.group(0))
            if len(nums) >= 2:
                a = float(nums[-2].replace(",", ""))
                b = float(nums[-1].replace(",", ""))
                if 1800 <= a <= 2100 and 1 <= b <= 12:
                    continue
                if 1800 <= b <= 2100:
                    continue
                return [a, b]
    return None


def _extract_holding_period(text: str) -> Optional[str]:
    """Extract a holding period like 持有 6-12 个月 / time horizon N months."""
    import re
    if not text:
        return None
    m = re.search(r"(?:持有|期限|horizon|holding)[^\n]{0,16}?(\d{1,3})(?:\s*[~\-–—]\s*(\d{1,3}))?\s*(?:个)?月", text, re.I)
    if m:
        return f"{m.group(1)}-{m.group(2)}" if m.group(2) else m.group(1)
    return None


def build_structured_report(report_sections: Dict[str, Any], decision_text: str) -> Dict[str, Any]:
    """Normalize collected agent outputs into the frontend report contract shape."""
    recommendation = recommendation_from_text(decision_text)
    overall_rating = rating_from_text(decision_text)
    grounded_evidence = list(report_sections.get("grounded_evidence") or [])
    risk_text = (
        report_sections.get("final_trade_decision")
        or report_sections.get("risk_assessment")
        or report_sections.get("risk_debate_state")
        or ""
    )
    stage_log = report_sections.get("stage_log") or []
    reflection = report_sections.get("reflection") or {}

    # WS-133：从 trader / 风险文本提取「价格区间 / 持有期限 / 置信度」，落到契约字段
    trade_text = " ".join([
        str(report_sections.get("trader_investment_plan") or ""),
        str(report_sections.get("investment_plan") or ""),
        str(report_sections.get("final_trade_decision") or ""),
        str(decision_text or ""),
    ])
    price_range = _extract_price_range(trade_text)
    holding_period = _extract_holding_period(trade_text)
    confidence = round(overall_rating / 5, 2) if overall_rating else 0.0

    return {
        "rating": overall_rating,
        "recommendation": recommendation,
        "confidence": confidence,
        "price_range": price_range,
        "holding_period": holding_period,
        "summary": _clip(decision_text, 800),
        "sections": {
            "market_technical": section("市场/技术面", report_sections.get("market_report", ""), overall_rating),
            "fundamentals": section("基本面", report_sections.get("fundamentals_report", ""), overall_rating),
            "sentiment": section("舆情", report_sections.get("sentiment_report", ""), overall_rating),
            "news_macro": section("新闻/宏观", report_sections.get("news_report", ""), overall_rating),
            "risk": section("风险", str(risk_text), overall_rating),
        },
        "grounded_evidence": grounded_evidence,
        "stage_log": stage_log,
        "reflection": {
            "decision_log": _clip(reflection.get("decision_log") or decision_text, 1200),
            "alpha": _clip(reflection.get("alpha") or "待同标的后续复盘计算。", 400),
            "lessons": reflection.get("lessons") or [],
        },
    }


def previous_decision_reflection(previous_record: Any) -> Dict[str, Any] | None:
    """Create a reflection block from the previous completed analysis record."""
    if not previous_record:
        return None
    final_state = previous_record.final_state or {}
    previous_structured = final_state.get("structured_report") if isinstance(final_state, dict) else None
    previous_rating = previous_structured.get("rating") if isinstance(previous_structured, dict) else None
    previous_recommendation = previous_structured.get("recommendation") if isinstance(previous_structured, dict) else None
    return {
        "previous_analysis_id": previous_record.analysis_id,
        "previous_completed_at": previous_record.completed_at.isoformat() if previous_record.completed_at else None,
        "previous_decision": previous_record.trading_decision,
        "previous_rating": previous_rating,
        "previous_recommendation": previous_recommendation,
        "alpha": "尚未接入价格回测，先注入上次决策供本次反思对照。",
        "lessons": [
            "对照上次决策，说明本次评级变化的新增证据。",
            "如果结论不变，明确哪些事实继续支撑原判断。",
        ],
    }
