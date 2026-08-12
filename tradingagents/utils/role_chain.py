"""
Role-chain report builder.

Maps the multi-agent TradingAgents graph final_state into the structured
RoleChainReport contract consumed by the frontend report page.

Chain order (top -> bottom):
    Risk Judge final decision (pinned)
      -> Analyst Team (Market / Social / News / Fundamentals)
      -> Research Debate (Bull / Bear / Research Manager)
      -> Trading Plan (Trader, non-executive)
      -> Risk Debate (Risky / Safe / Neutral)
      -> Final summary

Design rules (agreed with frontend, see docs/report-role-chain-contract.md):
  * priceBand / confidence / horizon are heuristic extractions and MAY be None
    when the underlying text is missing - frontend must show a "示例 / 延迟"
    badge instead of inventing numbers.
  * The Trader plan is research guidance only - note is a fixed string and the
    whole site renders no order-execution entry.
  * Risk-debate keys are normalized: upstream v0.2.5 uses aggressive /
    conservative; this fork uses risky / safe. We accept both and emit a
    canonical risky / safe / neutral shape.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


# Verdict mapping from raw BUY/SELL/HOLD (and Chinese variants) to the
# 5-level frontend vocabulary. final_trade_decision is a free-text string
# that the Risk Judge produces; we pattern-match it.
_VERDICT_RULES = [
    ("strong_buy", [r"strong\s*buy", r"强烈买入", r"大幅增持", r"重仓买入"]),
    ("buy", [r"\bbuy\b", r"买入", r"增持", r"建仓"]),
    ("overweight", [r"overweight", r"审慎增持", r"谨慎增持", r"适度增持"]),
    ("reduce", [r"\bsell\b", r"卖出", r"减持", r"清仓"]),
    ("watch", [r"\bhold\b", r"持有", r"观望", r"等待"]),
]

VERDICT_LABELS = {
    "strong_buy": "强势买入",
    "buy": "买入",
    "overweight": "审慎增持",
    "hold": "持有",
    "reduce": "减持",
    "watch": "观望",
}

STANCE_LABELS = {
    "positive": "积极",
    "warm": "偏多",
    "neutral": "中性",
    "cooling": "偏空",
    "negative": "看空",
}

RISK_LEVELS = {"low", "moderate", "elevated", "high"}

TRADER_NOTE = "研究建议，非下单执行入口"


def _clip(text, limit=1600):
    value = str(text or "").strip()
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value[:limit]


def _to_str(text):
    return _clip(text, 6000)


def _verdict_from_text(text):
    lowered = (text or "").lower()
    for verdict, patterns in _VERDICT_RULES:
        for pattern in patterns:
            if re.search(pattern, lowered):
                return verdict
    return "hold"


def _stance_from_text(role, text):
    """Heuristic stance guess from an analyst report body."""
    body = (text or "").lower()
    score = 0
    if re.search(r"看涨|上涨|bullish|上行|走强|突破|增[长加]|利好|机会", body):
        score += 2
    if re.search(r"看跌|下跌|bearish|下行|走弱|跌破|下滑|利空|风险", body):
        score -= 2
    if re.search(r"超买|高估|压力位|回调", body):
        score -= 1
    if re.search(r"超卖|低估|支撑位|反弹|回升", body):
        score += 1
    if score >= 2:
        return "positive"
    if score == 1:
        return "warm"
    if score <= -2:
        return "negative"
    if score == -1:
        return "cooling"
    return "neutral"


def _first_lines(text, n=2):
    return [line.strip("-*• \t") for line in (text or "").splitlines() if line.strip()][:n]


def _price_band(text, market):
    """Best-effort price-range extraction. Returns None when nothing parses."""
    if not text:
        return None
    currency = {"US": "USD", "HK": "HKD", "CN": "CNY"}.get((market or "").upper(), "USD")
    pattern = re.compile(
        r"(?:HK\$|¥|\$)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:[-–—~]|到|至|to)\s*(?:HK\$|¥|\$)?\s*([0-9]+(?:[.,][0-9]+)?)"
    )
    for match in pattern.finditer(text):
        low = float(match.group(1).replace(",", ""))
        high = float(match.group(2).replace(",", ""))
        if 0 < low < high < low * 5:
            return {"low": low, "high": high, "currency": currency, "basis": "示例"}
    return None


def _confidence_from_text(text):
    if not text:
        return None
    for pattern in (r"置信度[^\d]{0,6}([0-9]{1,3})", r"confidence[^\d]{0,6}([0-9]{1,3})", r"(\b[7-9][0-9])\s*%"):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = int(match.group(1))
            if 0 <= value <= 100:
                return value
    return None


def _horizon_from_text(text):
    if not text:
        return None
    for pattern in (
        r"(1\s*[-—~]\s*3\s*个?\s*月)",
        r"(3\s*[-—~]\s*6\s*个?\s*月)",
        r"(6\s*[-—~]\s*12\s*个?\s*月)",
        r"(短[期线])",
        r"(中[期线])",
        r"(长[期线])",
    ):
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def _risk_level_from_text(text):
    body = (text or "")
    if re.search(r"高风险|极高|aggressive|risky|波动剧烈", body, re.IGNORECASE):
        return "high"
    if re.search(r"偏高|elevated|较大波动", body, re.IGNORECASE):
        return "elevated"
    if re.search(r"较低|low risk|稳健", body, re.IGNORECASE):
        return "low"
    return "moderate"


def _as_dict(value):
    return value if isinstance(value, dict) else {}


_ANALYST_DEFS = [
    ("market", "MKT", "市场分析师", "Market Analyst", "market_report"),
    ("social", "SOC", "舆情分析师", "Social Media Analyst", "sentiment_report"),
    ("news", "NEWS", "新闻分析师", "News Analyst", "news_report"),
    ("fundamentals", "FND", "基本面分析师", "Fundamentals Analyst", "fundamentals_report"),
]


def _build_analysts(final_state):
    out = []
    for role, code, zh, _en, key in _ANALYST_DEFS:
        body = _to_str(final_state.get(key, ""))
        out.append({
            "role": role,
            "code": code,
            "title": zh,
            "subtitle": "",
            "stance": _stance_from_text(role, body),
            "summary": _clip(body, 400) or "暂无足够数据，待后续复核。",
            "evidence": _first_lines(body, 3),
            "hasContent": bool(body),
        })
    return out


def _debate_side(history, current):
    """Pick the most informative text for one side of a debate."""
    candidates = [current, history]
    for candidate in candidates:
        text = _to_str(candidate)
        if text:
            headline = _first_lines(text, 1)[0] if _first_lines(text, 1) else ""
            return {"headline": headline, "summary": _clip(text, 800)}
    return {"headline": "暂无发言", "summary": ""}


def _build_debate(final_state):
    debate = _as_dict(final_state.get("investment_debate_state"))
    bull = _debate_side(debate.get("bull_history"), debate.get("current_response") if debate.get("latest_speaker") == "bull" else None)
    bear = _debate_side(debate.get("bear_history"), None)
    manager_text = _to_str(debate.get("judge_decision"))
    return {
        "bull": bull,
        "bear": bear,
        "manager": {"summary": _clip(manager_text, 800) or "研究经理尚未给出裁决。"},
    }


def _build_trader(final_state, market, decision_text):
    plan = _to_str(final_state.get("trader_investment_plan") or final_state.get("investment_plan"))
    verdict = _verdict_from_text(plan or decision_text)
    return {
        "verdict": verdict,
        "verdictLabel": VERDICT_LABELS.get(verdict, "持有"),
        "priceBand": _price_band(plan, market),
        "positionCapPct": None,
        "note": TRADER_NOTE,
        "hasContent": bool(plan),
        "summary": _clip(plan, 800),
    }


def _build_risk_debate(final_state):
    debate = _as_dict(final_state.get("risk_debate_state"))
    risky_text = _to_str(debate.get("current_risky_response") or debate.get("risky_history") or debate.get("current_aggressive_response") or debate.get("aggressive_history"))
    safe_text = _to_str(debate.get("current_safe_response") or debate.get("safe_history") or debate.get("current_conservative_response") or debate.get("conservative_history"))
    neutral_text = _to_str(debate.get("current_neutral_response") or debate.get("neutral_history"))
    return {
        "risky": _debate_side(risky_text, None),
        "safe": _debate_side(safe_text, None),
        "neutral": _debate_side(neutral_text, None),
    }


def _build_decision(final_state, market):
    decision_text = _to_str(final_state.get("final_trade_decision"))
    risk_state = _as_dict(final_state.get("risk_debate_state"))
    risk_text = _to_str(risk_state.get("judge_decision"))
    verdict = _verdict_from_text(decision_text)
    pool = decision_text + "\n" + risk_text
    return {
        "verdict": verdict,
        "verdictLabel": VERDICT_LABELS.get(verdict, "持有"),
        "rationale": _clip(decision_text, 1000) or "裁决尚未产出。",
        "priceBand": _price_band(pool, market),
        "riskLevel": _risk_level_from_text(pool),
        "horizon": _horizon_from_text(pool),
        "confidence": _confidence_from_text(pool),
    }


def build_role_chain(final_state, *, ticker="", company="", market=None,
                     published_at="", model_id="", summary=""):
    """Build the full RoleChainReport dict from a graph final_state.

    final_state may be {}; every node degrades gracefully so partial analyses
    still render without crashing.
    """
    final_state = _as_dict(final_state)
    decision = _build_decision(final_state, market)
    return {
        "id": "",
        "ticker": ticker,
        "company": company or ticker,
        "market": market,
        "title": (company or ticker) + " 多智能体研究报告",
        "publishedAt": published_at,
        "author": {"name": "TradingAgents 多智能体"},
        "modelId": model_id,
        "depth": "standard",
        "decision": decision,
        "analysts": _build_analysts(final_state),
        "debate": _build_debate(final_state),
        "traderPlan": _build_trader(final_state, market, decision.get("rationale", "")),
        "riskDebate": _build_risk_debate(final_state),
        "summary": _clip(summary or decision.get("rationale", ""), 1200),
        "meta": {
            "sources": len(final_state.get("grounded_evidence") or []) if isinstance(final_state.get("grounded_evidence"), list) else 0,
            "generatedAt": published_at,
            "disclaimer": "本报告由 AI 多智能体生成，所有行情与价格均为示例或延迟数据，仅供研究参考，不构成任何投资建议或下单执行入口。",
        },
    }


def role_chain_is_empty(report):
    """True when the role chain carries no real agent content (only scaffolding)."""
    if not report:
        return True
    analysts = report.get("analysts") or []
    if any(a.get("hasContent") for a in analysts):
        return False
    mgr = (report.get("debate", {}).get("manager", {}).get("summary", "") or "").strip()
    if mgr and mgr != "研究经理尚未给出裁决。":
        return False
    if report.get("traderPlan", {}).get("hasContent"):
        return False
    return True

